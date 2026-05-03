const validator = require('validator');
const User = require('../models/User');

/**
 * GET /onboarding
 * Onboarding page.
 */
exports.getOnboarding = async (req, res) => {
  const user = await User.findById(req.user.id);

  if (user.fields.ONBOARDING_DONE === 'true') {
    return res.redirect('/dashboard');
  }
  return res.render('onboarding', {
    title: "Let's started!",
  });
};

/**
 * GET /onboarding/:nextstep
 * Onboarding page.
 */
exports.getOnboardingNextStep = (req, res) => {
  res.render('onboarding', {
    title: "Let's started!",
    step: req.query.step,
    repo: req.query.repo,
    owner: req.query.owner,
    description: req.query.description,
    creationDate: req.query.creationDate,
    private: req.query.private,
  });
};

/**
 * POST /onboarding
 * Validates GitHub repo URL + PAT, saves settings.
 */
exports.postOnboarding = async (req, res, next) => {
  const validationErrors = [];

  // Validate URL format
  if (!validator.isURL(req.body.floatingInputRepo)) {
    validationErrors.push({ msg: 'Please enter a valid GitHub repository URL.' });
  } else {
    // Validate that the URL points to github.com specifically
    try {
      const parsedUrl = new URL(req.body.floatingInputRepo);
      if (parsedUrl.hostname !== 'github.com') {
        validationErrors.push({ msg: 'Please enter a valid GitHub repository URL (github.com only).' });
      }
    } catch {
      validationErrors.push({ msg: 'Please enter a valid GitHub repository URL.' });
    }
  }

  if (!validator.isLength(req.body.floatingInputPat, { min: 10 })) {
    validationErrors.push({ msg: 'Please enter a valid GitHub personal access token.' });
  }

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/onboarding');
  }

  try {
    const username = req.body.floatingInputRepo.split('/')[3];
    const repoName = req.body.floatingInputRepo.split('/')[4];

    if (!username || !repoName) {
      req.flash('errors', { msg: 'Please enter a valid GitHub repository URL (format: https://github.com/owner/repo).' });
      return res.redirect('/onboarding');
    }

    const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
      method: 'GET',
      headers: { Authorization: `token ${req.body.floatingInputPat}` },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = body.message === 'Bad credentials'
        ? 'Invalid GitHub personal access token.'
        : 'Repository not found or access denied.';
      req.flash('errors', { msg });
      return res.redirect('/onboarding');
    }

    const repo = await response.json();
    const repoInfos = {
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description || '',
      creationDate: repo.created_at,
      private: repo.private,
    };

    await User.setGithubSettings(req.user.id, {
      username,
      token: req.body.floatingInputPat,
      repository: repoInfos,
    });

    req.flash('success', { msg: 'Your repo/PAT is valid!' });
    return res.redirect(
      `/onboarding/nextstep?step=2`
      + `&repo=${encodeURIComponent(repoInfos.name)}`
      + `&owner=${encodeURIComponent(repoInfos.owner)}`
      + `&description=${encodeURIComponent(repoInfos.description)}`
      + `&creationDate=${encodeURIComponent(repoInfos.creationDate)}`
      + `&private=${encodeURIComponent(repoInfos.private)}`,
    );
  } catch (error) {
    console.error('postOnboarding error:', error);
    req.flash('errors', { msg: 'An error occurred while updating your settings.' });
    return res.redirect('/onboarding');
  }
};

/**
 * POST /onboarding/nextstep
 * Enables GitHub integration and marks onboarding complete.
 */
exports.postOnboardingNextStep = async (req, res, next) => {
  try {
    await User.enableGithub(req.user.id);

    req.flash('success', { msg: 'Your settings have been saved.' });
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('postOnboardingNextStep error:', error);
    req.flash('errors', { msg: 'An error occurred while updating your settings.' });
    return res.redirect('/onboarding');
  }
};
