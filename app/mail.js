const nodemailer = require('nodemailer');

// Email congig
let transporter = nodemailer.createTransport({
        host: 'email-smtp.us-east-1.amazonaws.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: 'AKIAJBFWXUMXCL6AF43A', 
            pass: 'AuBPm+Re5Crdii0B9ze5g0vXteQd3+Mh7nXB+DvswKD2' 
        }
    });

module.exports.sentMail=(mailDetails)=>{
    console.log(mailDetails);
    return new Promise((resolve,reject)=>{
        let mailOptions = {
            from: mailDetails.from,
            to: mailDetails.to,
            subject: mailDetails.subject,
            html: mailDetails.html,
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject(error);
            }
            resolve(info)
        });
    
    })
}
