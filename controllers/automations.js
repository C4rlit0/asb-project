const User = require('../models/User');

/**
 * GET /automations
 * List all saved automations from the user's GitHub repository.
 */
exports.getAutomations = async (req, res, next) => {
  const {
    GITHUB_ORG,
    GITHUB_PAT,
    GITHUB_REPO,
  } = req.user.fields;

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_REPO}/contents/`, {
      method: 'GET',
      headers: {
        Authorization: `token ${GITHUB_PAT}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const automations = await response.json();

    res.render('automations', {
      title: 'List of automations',
      automations,
    });
  } catch (error) {
    console.error('getAutomations error:', error);
    next(error);
  }
};
