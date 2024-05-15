const bcrypt = require('@node-rs/bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

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
      GRAVATAR_URL: this.gravatar({ email }),
    };
    return await base('Users').create(user);
  },
  findByEmail: async function (email) {
    const records = await base('Users')
      .select({ filterByFormula: `email = "${email}"` })
      .firstPage();
    if (records.length > 0) {
      const {
        id,
        fields
      } = records[0];
      return { id, fields };
    } else {
      console.log('No records found');
      return null;
    }
  },
  findById: async function (id) {
    const record = await base('Users').find(id);
    return record;
  },
  comparePassword: async function (user, candidatePassword) {
    return await bcrypt.compare(candidatePassword, user.fields.PASSWORD);
  },
  getOnboardingStatus: function (user) {
    return user.fields.onboardingStatus || false;
  },
  setOnboardingStatus: async function (user, status) {
    await base('Users').update(user.id, { onboardingStatus: status });
  },
  getSettings: function (user) {
    return user.fields.settings || {};
  },
  setSettings: async function (user, settings) {
    await base('Users').update(user.id, { settings: settings });
  },
  enableGithub: async function (user, username, token) {
    const settings = this.getSettings(user);
    settings.github = {
      enabled: true,
      username,
      token,
    };
    await this.setSettings(user, settings);
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
  gravatar: function (user, size) {
    if (!size) {
      size = 200;
    }
    if (!user.fields.email) {
      return `https://gravatar.com/avatar/00000000000000000000000000000000?s=${size}&d=retro`;
    }
    const md5 = crypto.createHash('md5').update(user.fields.email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
  },
};

module.exports = User;
