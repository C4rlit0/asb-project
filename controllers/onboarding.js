const validator = require('validator');
const { set } = require('lodash');
const User = require('../models/User');

/**
 * GET /
 * Onboarding page.
 */
exports.getOnboarding = async (req, res) => {
  // Get the user from the database
  const user = await User.findById(req.user.id);

  // Render onboarding page only if user haven't already done it
  if (user.fields.ONBOARDING_DONE === 'true') {
    return res.redirect('/dashboard');
  }
  return res.render('onboarding', {
    title: 'Let\'s started!',
  });
};

/**
 * GET /onboarding/:nextstep
 * Onboarding page.
 * @param {string} nextstep
 * @param {string} repo
 * @param {string} owner
 * @param {string} description
 */
exports.getOnboardingNextStep = (req, res) => {
  res.render('onboarding', {
    title: 'Let\'s started!',
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
 * Onboarding page.
 */
exports.postOnboarding = async (req, res, next) => {
  // This function receives the POST request from the onboarding form with github repo URL and PAT token
  const validationErrors = [];
  if (!validator.isURL(req.body.floatingInputRepo)) validationErrors.push({ msg: 'Please enter a valid GitHub repository URL.' });
  if (!validator.isLength(req.body.floatingInputPat, { min: 90, max: 100 })) validationErrors.push({ msg: 'Please enter a valid GitHub personal access token.' });

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/onboarding');
  }

  try {

    // Extract username from GitHub repo URL
    const username = req.body.floatingInputRepo.split('/')[3];

    // Test if Github PAT is valid to fetch repo infos
    try {
      const response = await fetch(`https://api.github.com/repos/${username}/${req.body.floatingInputRepo.split('/')[4]}`, {
        method: 'GET',
        headers: {
          Authorization: `token ${req.body.floatingInputPat}`
        }
      });

      // Extract repo infos from response
      const repo = await response.json();
      console.log('repo', repo);
      // If the response contains an error message, we throw an error
      if (repo.message === 'Bad credentials') {
        throw new Error('Invalid GitHub personal access token.');
      }

      const repoInfos = {
        name: repo.name,
        owner: repo.owner.login,
        description: repo.description ? repo.description : '',
        creationDate: repo.created_at,
        private: repo.private,
      };

      // If the response is 200, we can save the Github settings
      User.setGithubSettings(req.user.id, {
          username,
          token: req.body.floatingInputPat,
          repository: repoInfos,
      });

      req.flash('success', { msg: 'Your repo/PAT is valid!' });
      // Redirect to the next step of the onboarding and pass the repo infos
      return res.redirect(`/onboarding/nextstep?step=2&repo=${repoInfos.name}&owner=${repoInfos.owner}&description=${repoInfos.description}&creationDate=${repoInfos.creationDate}&private=${repoInfos.private}`);
    } catch (error) {
      console.error(error);
      req.flash('errors', { msg: error.message });
      return res.redirect('/onboarding');
    }
  } catch (error) {
    console.error(error);
    req.flash('errors', { msg: 'An error occurred while updating your settings.' });
    return res.redirect('/onboarding');
  }
};

/**
 * POST /onboarding/nextstep
 * Onboarding page.
 */
exports.postOnboardingNextStep = async (req, res, next) => {
  // This function receives the POST request from the onboarding form with the repo infos
  try {

    // If user validate the repo infos, we can enable the Github integration and set onboarding status to true
    User.enableGithub(req.user.id);
    // User.setOnboardingStatus(req.user.id, true);

    req.flash('success', { msg: 'Your settings have been saved.' });
    // Redirect to the user dashboard
    return res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    req.flash('errors', { msg: 'An error occurred while updating your settings.' });
    return res.redirect('/onboarding');
  }
};
