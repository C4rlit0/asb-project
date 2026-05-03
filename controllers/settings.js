const validator = require('validator');
const User = require('../models/User');

/**
 * GET /account/settings
 * Settings page.
 */
exports.getSettings = async (req, res) => {
  res.render('account/settings', {
    title: 'Update your settings',
  });
};

/**
 * POST /account/settings
 * Update GitHub repo URL and PAT.
 */
exports.postSettings = async (req, res, next) => {
  const validationErrors = [];

  // Validate URL format
  if (!validator.isURL(req.body.floatingInputRepo)) {
    validationErrors.push({ msg: 'Please enter a valid GitHub repository URL.' });
  } else {
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
    return res.redirect('/account/settings');
  }

  try {
    const username = req.body.floatingInputRepo.split('/')[3];
    const repoName = req.body.floatingInputRepo.split('/')[4];

    if (!username || !repoName) {
      req.flash('errors', { msg: 'Please enter a valid GitHub repository URL (format: https://github.com/owner/repo).' });
      return res.redirect('/account/settings');
    }

    const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
      method: 'GET',
      headers: { Authorization: `token ${req.body.floatingInputPat}` },
    });

    if (!response.ok) {
      throw new Error('Invalid GitHub personal access token or repository not found.');
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

    req.flash('success', { msg: 'Your GitHub settings have been updated.' });
    return res.redirect('/account/settings');
  } catch (error) {
    console.error('postSettings error:', error);
    req.flash('errors', { msg: error.message || 'An error occurred while updating your settings.' });
    return res.redirect('/account/settings');
  }
};
