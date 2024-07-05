const User = require('../models/User');

/**
 * GET /
 * Dashboard page.
 */

exports.getDashboard = async (req, res) => {
  // Function to get all saved automations from GitHub
  const {
    GITHUB_ORG,
    GITHUB_PAT,
    GITHUB_REPO,
  } = req.user.fields;

  // const response = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_REPO}/contents/`, {
  //   method: 'GET',
  //   headers: {
  //     Authorization: `token ${GITHUB_PAT}`
  //   }
  // });

  // // Extract repo infos from response
  // const automations = await response.json();
  // console.log('automations', automations);

  // Get the user from the database
  const user = await User.findById(req.user.id);

  // Render dashboard page only if user have already done onboarding process
  if (user.fields.ONBOARDING_DONE === 'false') {
    return res.redirect('/onboarding');
  }
  res.render('dashboard', {
    title: 'Dashboard',
    // automations,
  });
};
