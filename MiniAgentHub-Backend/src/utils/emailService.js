const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { i18next } = require('../config/i18n');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const BANNER_PATH = path.join(__dirname, '../../../assets/unnamed.jpg');

const sendWelcomeEmail = async (toEmail, fullName, rawPassword, lng = 'vi') => {
    const t = i18next.getFixedT(lng);

    const mailOptions = {
        from: `"Agent Hub Admin" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: t('email.welcome.subject', 'Welcome to Agent Hub - Your Login Credentials'),
        html: `
        <div style="background-color: #111111; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a; margin: 0 auto;">
                
                <tr>
                    <td align="center" style="padding: 20px 0; border-bottom: 1px solid #2a2a2a;">
                        <span style="color: #ffffff; font-size: 14px; font-weight: 600; letter-spacing: 2px;">AGENT HUB</span>
                    </td>
                </tr>

                <tr>
                    <td style="background-color: #000000;">
                        <img src="cid:banner@agenthub" alt="Agent Hub Banner" width="600" height="200" style="display: block; width: 100%; object-fit: cover; opacity: 0.8;" />
                    </td>
                </tr>

                <tr>
                    <td style="padding: 40px 30px;">
                        <p style="color: #6da3d4; font-size: 10px; font-weight: 700; letter-spacing: 2px; margin: 0 0 12px 0;">${t('email.welcome.onboardingConfirmed', 'ONBOARDING CONFIRMED')}</p>
                        <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 15px 0; font-weight: 600;">${t('email.welcome.title', 'Your Agent Hub account is ready')}</h2>
                        <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 35px 0;">
                            ${t('email.welcome.greeting', `Hello <strong>{{fullName}}</strong>,<br><br> Your registration is complete. Please use the temporary credentials below to access your new workspace for the first time.`, { fullName })}
                        </p>

                        <div style="background-color: #222222; border: 1px solid #333333; border-radius: 10px; padding: 25px;">
                            
                            <div style="margin-bottom: 25px; display: flex; align-items: center;">
                                <div>
                                    <h3 style="color: #ffffff; font-size: 15px; margin: 0 0 5px 0;">🔑 ${t('email.securityCredentials', 'Security Credentials')}</h3>
                                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${t('email.changePasswordAdvice', 'Please change your password after logging in.')}</p>
                                </div>
                            </div>

                            <div style="margin-bottom: 20px;">
                                <p style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin: 0 0 8px 0;">${t('email.loginEmail', 'LOGIN EMAIL')}</p>
                                <div style="background-color: #2a2a2a; padding: 14px 16px; border-radius: 6px; color: #ffffff; font-family: 'Courier New', Courier, monospace; font-size: 14px; border: 1px solid #3a3a3a;">
                                    ${toEmail}
                                </div>
                            </div>

                            <div>
                                <p style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin: 0 0 8px 0;">${t('email.temporaryPassword', 'TEMPORARY PASSWORD')}</p>
                                <div style="background-color: #2a2a2a; padding: 14px 16px; border-radius: 6px; color: #ffffff; font-family: 'Courier New', Courier, monospace; font-size: 14px; border: 1px solid #3a3a3a; letter-spacing: 1px;">
                                    ${rawPassword}
                                </div>
                            </div>

                        </div>

                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: block; width: 100%; text-align: center; background-color: #006ecf; color: #ffffff; text-decoration: none; padding: 16px 0; border-radius: 8px; font-weight: 600; margin-top: 35px; font-size: 15px;">
                            ${t('email.loginToDashboard', 'Log in to Dashboard &rarr;')}
                        </a>

                        <p style="text-align: center; color: #9ca3af; font-size: 13px; margin-top: 30px;">
                            ${t('email.welcome.footerSupport', 'If you have any questions, feel free to contact the Agent Hub support team.')}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding: 0 30px 40px 30px; text-align: center;">
                        <div style="border-top: 1px solid #2a2a2a; padding-top: 30px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 20px 0;">
                                <a href="#" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">${t('email.privacyPolicy', 'Privacy Policy')}</a>
                                <a href="#" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">${t('email.termsOfService', 'Terms of Service')}</a>
                                <a href="#" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">${t('email.helpCenter', 'Help Center')}</a>
                            </p>
                            <p style="color: #666666; font-size: 10px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                                &copy; 2026 AGENT HUB INC.<br> <span style="display: inline-block; margin-top: 8px;">📍 GLOBAL INTELLIGENCE NODE #42</span>
                            </p>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        `,
        attachments: [
            {
                filename: 'banner.jpg',
                path: BANNER_PATH,
                cid: 'banner@agenthub'
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Đã gửi email thành công tới: ${toEmail}`);
    } catch (error) {
        console.error(`Lỗi gửi email tới ${toEmail}:`, error);
        throw new Error('Không thể gửi email lúc này.');
    }
};

const sendResetPasswordEmail = async (toEmail, fullName, rawPassword, lng = 'vi') => {
    const t = i18next.getFixedT(lng);

    const mailOptions = {
        from: `"Agent Hub Admin" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: t('email.reset.subject', 'Agent Hub - Password Reset'),
        html: `
        <div style="background-color: #111111; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a; margin: 0 auto;">
                
                <tr>
                    <td align="center" style="padding: 20px 0; border-bottom: 1px solid #2a2a2a;">
                        <span style="color: #ffffff; font-size: 14px; font-weight: 600; letter-spacing: 2px;">AGENT HUB</span>
                    </td>
                </tr>

                <tr>
                    <td style="background-color: #000000;">
                        <img src="cid:banner@agenthub" alt="Agent Hub Banner" width="600" height="200" style="display: block; width: 100%; object-fit: cover; opacity: 0.8;" />
                    </td>
                </tr>

                <tr>
                    <td style="padding: 40px 30px;">
                        <p style="color: #6da3d4; font-size: 10px; font-weight: 700; letter-spacing: 2px; margin: 0 0 12px 0;">${t('email.reset.passwordReset', 'PASSWORD RESET')}</p>
                        <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 15px 0; font-weight: 600;">${t('email.reset.title', 'Your new temporary password')}</h2>
                        <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 35px 0;">
                            ${t('email.reset.greeting', `Hello <strong>{{fullName}}</strong>,<br><br> We received a request to reset the password for your Agent Hub account. Please use the temporary credentials below to log in. You will be asked to create a new, secure password immediately after logging in.`, { fullName })}
                        </p>

                        <div style="background-color: #222222; border: 1px solid #333333; border-radius: 10px; padding: 25px;">
                            
                            <div style="margin-bottom: 25px; display: flex; align-items: center;">
                                <div>
                                    <h3 style="color: #ffffff; font-size: 15px; margin: 0 0 5px 0;">🔑 ${t('email.securityCredentials', 'Security Credentials')}</h3>
                                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${t('email.changePasswordAdviceReset', 'Please change your password immediately after logging in.')}</p>
                                </div>
                            </div>

                            <div style="margin-bottom: 20px;">
                                <p style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin: 0 0 8px 0;">${t('email.loginEmail', 'LOGIN EMAIL')}</p>
                                <div style="background-color: #2a2a2a; padding: 14px 16px; border-radius: 6px; color: #ffffff; font-family: 'Courier New', Courier, monospace; font-size: 14px; border: 1px solid #3a3a3a;">
                                    ${toEmail}
                                </div>
                            </div>

                            <div>
                                <p style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin: 0 0 8px 0;">${t('email.temporaryPassword', 'TEMPORARY PASSWORD')}</p>
                                <div style="background-color: #2a2a2a; padding: 14px 16px; border-radius: 6px; color: #ffffff; font-family: 'Courier New', Courier, monospace; font-size: 14px; border: 1px solid #3a3a3a; letter-spacing: 1px;">
                                    ${rawPassword}
                                </div>
                            </div>

                        </div>

                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: block; width: 100%; text-align: center; background-color: #006ecf; color: #ffffff; text-decoration: none; padding: 16px 0; border-radius: 8px; font-weight: 600; margin-top: 35px; font-size: 15px;">
                            ${t('email.loginToDashboard', 'Log in to Dashboard &rarr;')}
                        </a>

                        <p style="text-align: center; color: #9ca3af; font-size: 13px; margin-top: 30px;">
                            ${t('email.reset.footerSupport', 'If you did not request a password reset, please ignore this email or contact support if you have concerns.')}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding: 0 30px 40px 30px; text-align: center;">
                        <div style="border-top: 1px solid #2a2a2a; padding-top: 30px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 20px 0;">
                                <a href="#" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">${t('email.privacyPolicy', 'Privacy Policy')}</a>
                                <a href="#" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">${t('email.termsOfService', 'Terms of Service')}</a>
                                <a href="#" style="color: #9ca3af; text-decoration: none; margin: 0 12px;">${t('email.helpCenter', 'Help Center')}</a>
                            </p>
                            <p style="color: #666666; font-size: 10px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                                &copy; 2026 AGENT HUB INC.<br> <span style="display: inline-block; margin-top: 8px;">📍 GLOBAL INTELLIGENCE NODE #42</span>
                            </p>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        `,
        attachments: [
            {
                filename: 'unnamed.jpg',
                path: BANNER_PATH,
                cid: 'banner@agenthub'
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Đã gửi email khôi phục mật khẩu tới: ${toEmail}`);
    } catch (error) {
        console.error(`Lỗi gửi email khôi phục tới ${toEmail}:`, error);
        throw new Error('Không thể gửi email lúc này.');
    }
};

module.exports = { sendWelcomeEmail, sendResetPasswordEmail };