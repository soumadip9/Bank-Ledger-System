require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error("Error connecting to email server:", error);
    } else {
        console.log("Email server is ready to send messages");
    }
});

// Generic send email function
const sendEmail = async (to, subject, text, html) => {
    if (!process.env.EMAIL_USER || !process.env.CLIENT_ID || !process.env.REFRESH_TOKEN) {
        console.warn("Email skipped: OAuth env vars not configured");
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: `"Soumadip Ghosh" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log("Message sent:", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error.message || error);
        // Do not throw — email must not fail API requests
    }
};

// Registration Email
async function sendRegistrationEmail(userEmail, name) {
    const subject = "Welcome to Our Service!";

    const text = `
Hello ${name},

Thank you for registering with our service!

We're excited to have you on board.

Best Regards,
Soumadip
`;

    const html = `
<h2>Welcome ${name}!</h2>

<p>Thank you for registering with our service.</p>

<p>We're excited to have you on board.</p>

<p>
Best Regards,<br>
Soumadip
</p>
`;

    await sendEmail(userEmail, subject, text, html);
}

// Transaction Success Email
async function sendTransactionEmail(
    userEmail,
    senderName,
    receiverName,
    amount
) {
    const subject = "Transaction Successful";

    const text = `
Hello ${senderName},

Your transaction was completed successfully.

Amount: ₹${amount}

Transferred To: ${receiverName}

Thank you for using our service.
`;

    const html = `
<h2>Transaction Successful</h2>

<p>Hello <b>${senderName}</b>,</p>

<p>Your transaction has been completed successfully.</p>

<ul>
    <li><b>Amount:</b> ₹${amount}</li>
    <li><b>Transferred To:</b> ${receiverName}</li>
</ul>

<p>Thank you for using our service.</p>
`;

    await sendEmail(userEmail, subject, text, html);
}

// Transaction Failure Email
async function transactionFailureEmail(
    userEmail,
    senderName,
    receiverName,
    amount
) {
    const subject = "Transaction Failed";

    const text = `
Hello ${senderName},

Unfortunately your transaction could not be completed.

Amount: ₹${amount}

Recipient: ${receiverName}

Please try again later.
`;

    const html = `
<h2>Transaction Failed</h2>

<p>Hello <b>${senderName}</b>,</p>

<p>Unfortunately your transaction could not be completed.</p>

<ul>
    <li><b>Amount:</b> ₹${amount}</li>
    <li><b>Recipient:</b> ${receiverName}</li>
</ul>

<p>Please try again later.</p>
`;

    await sendEmail(userEmail, subject, text, html);
}

module.exports = {
    sendRegistrationEmail,
    sendTransactionEmail,
    transactionFailureEmail,
};