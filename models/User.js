const bcrypt = require('@node-rs/bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const usersTable = base(process.env.AIRTABLE_USERS_TABLE_NAME || 'USERS');
const sessionsTable = base(process.env.AIRTABLE_SESSIONS_TABLE_NAME || 'SESSIONS');

const settingsModel = JSON.parse(fs.readFileSync(path.join(__dirname, './json/userSettingsModel.json')));

// USERS_BASE_MODEL = [
//   'ID', // Auto increment
//   'EMAIL',
//   'PASSWORD',
//   'GRAVATAR_URL',
//   'PWD_RESET_TKN',
//   'PWD_RESET_EXPIRES',
//   'EMAIL_VERIFICATION_TKN',
//   'EMAIL_VERIFIED',
//   'NAME',
//   'ONBOARDING_DONE',
//   'GITHUB_ENABLED',
//   'GITHUB_ORG',
//   'GITHUB_OWNER',
//   'GITHUB_PAT',
//   'GITHUB_REPO',
//   'GITHUB_REPO_STATUS',
//   'GITHUB_REPO_DESCRIPTION',
//   'GITHUB_REPO_CREATION_DATE',
// ];

const User = {
  create: async function (email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      EMAIL: email,
      PASSWORD: hashedPassword,
      PROFILE_PICTURE_URL: this.gravatar(email),
    };
    return await usersTable.create(user);
  },
  findByEmail: async function (email) {
    const records = await usersTable
      .select({ view: process.env.AIRTABLE_ALL_USERS_VIEW, filterByFormula: `EMAIL = "${email}"` })
      .firstPage();
    if (records.length > 0) {
      
      const {
        id,
        fields,
      } = records[0];
      
      return { id, fields };
    } else {
      console.log('No records found');
      return null;
    }
  },
  findById: async function (id) {
    console.log('Find user by id:', id)
    const record = await usersTable.find(id);
    return record;
  },
  comparePassword: async function (user, candidatePassword) {
    return await bcrypt.compare(candidatePassword, user.fields.PASSWORD);
  },
  updatePassword: async function (userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await usersTable.update(userId, { PASSWORD: hashedPassword });
  },
  updateProfile: async function (userId, email, name) {
    await usersTable.update(userId, { 
      EMAIL: email,
      NAME: name,
    });
  },
  getOnboardingStatus: function (user) {
    return user.fields.onboardingStatus || false;
  },
  setOnboardingStatus: async function (userId, status) {
    await usersTable.update(userId, { ONBOARDING_DONE: status });
  },
  getSettings: function (user) {
    return user.fields.settings || {};
  },
  setSettings: async function (user, settings) {
    await usersTable.update(user.id, { settings: settings });
  },
  setGithubSettings: async function (userId, settings) {
    const {
      username,
      token,
      repository,
    } = settings;

    await usersTable.update(userId, {
      GITHUB_ENABLED: false,
      GITHUB_OWNER: repository.owner,
      GITHUB_ORG: username,
      GITHUB_PAT: token,
      GITHUB_REPO: repository.name,
      GITHUB_REPO_STATUS: repository.private ? 'private' : 'public',
      GITHUB_REPO_DESCRIPTION: repository.description,
      GITHUB_REPO_CREATION_DATE: repository.creationDate,
    });
  },
  enableGithub: async function (userId) {
    await usersTable.update(userId, { 
      GITHUB_ENABLED: true,
      ONBOARDING_DONE: 'true',
    });
  },
  disableGithub: async function (user) {
    const settings = this.getSettings(user);
    settings.github = {
      enabled: false,
      username: '',
      token: '',
    };
    await this.setSettings(user, settings);
  },
  gravatar: function (email, size) {
    console.log('email:', email);
    if (!size) {
      size = 200;
    }
    if (!email) {
      return `https://gravatar.com/avatar/00000000000000000000000000000000?s=${size}&d=retro`;
    }
    const md5 = crypto.createHash('md5').update(email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
  },
  softDelete: function (user) {
    console.log('softDelete:', user);
    return usersTable.update(user, { DELETED: true });
  }
};

module.exports = User;
