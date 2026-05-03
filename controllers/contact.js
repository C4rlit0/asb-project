const axios = require('axios');
const validator = require('validator');
const { sendMail } = require('../services/mailer');

/**
 * GET /contact
 * Contact form page.
 */
exports.getContact = (req, res) => {
  const unknownUser = !(req.user);

  res.render('contact', {
    title: 'Contact',
    sitekey: process.env.RECAPTCHA_SITE_KEY,
    unknownUser,
  });
};

/**
 * POST /contact
 * Send a contact form via Nodemailer.
 */
exports.postContact = async (req, res) => {
  const validationErrors = [];
  let fromName;
  let fromEmail;
  if (!req.user) {
    if (validator.isEmpty(req.body.name)) validationErrors.push({ msg: 'Please enter your name' });
    if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' });
  }
  if (validator.isEmpty(req.body.message)) validationErrors.push({ msg: 'Please enter your message.' });

  try {
    const validateReCAPTCHA = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${req.body['g-recaptcha-response']}`,
      {},
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' } },
    );
    if (!validateReCAPTCHA.data.success) {
      validationErrors.push({ msg: 'reCAPTCHA validation failed.' });
    }

    if (validationErrors.length) {
      req.flash('errors', validationErrors);
      return res.redirect('/contact');
    }

    if (!req.user) {
      fromName = req.body.name;
      fromEmail = req.body.email;
    } else {
      fromName = (req.user.fields && req.user.fields.NAME) || '';
      fromEmail = req.user.fields.EMAIL;
    }

    const mailOptions = {
      to: process.env.SITE_CONTACT_EMAIL,
      from: `${fromName} <${fromEmail}>`,
      subject: 'Contact Form | AirSave',
      text: req.body.message,
    };

    await sendMail({
      successfulType: 'success',
      successfulMsg: 'Email has been sent successfully!',
      loggingError: 'ERROR: Could not send contact email.\n',
      errorType: 'errors',
      errorMsg: 'Error sending the message. Please try again shortly.',
      mailOptions,
      req,
    });

    return res.redirect('/contact');
  } catch (err) {
    console.error('ERROR: postContact failed.\n', err);
    req.flash('errors', { msg: 'Error sending the message. Please try again shortly.' });
    return res.redirect('/contact');
  }
};
