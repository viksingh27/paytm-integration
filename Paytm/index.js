const express = require("express");
const https = require("https");
const qs = require("querystring");
const checksum_lib = require("./Paytm/checksum");
const config = require("./Paytm/config");
const cors = require('cors');
const form = new formidable.IncomingForm(); 

const app = express();
app.use(cors())
const parseUrl = express.urlencoded({ extended: false });
const parseJson = express.json({ extended: false });

const PORT = 'mongodb+srv://testDevUser:testDevUser@cluster0.bpimv.mongodb.net/edu_intern?retryWrites=true&w=majority';
app.get("/", (req,res)=>{
    res.send("Hii From Server")
})
app.post("/paynow", [parseUrl, parseJson], (req, res) => {
  // Route for making payment
  console.log(">>>>",req.body)
  var paymentDetails = {
    orderID: req.body.id,
    amount: req.body.amount,
//     customerId: req.body.name.replace(/\w/, ''),
    customerEmail: req.body.email,
    customerPhone: req.body.phone,
//     customerRest: req.body.rest_name
}
if(!paymentDetails.amount || !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
    res.status(400).send('Payment failed')
} else {
    var params = {};
    params['MID'] = config.PaytmConfig.mid;
    params['WEBSITE'] = config.PaytmConfig.website;
    params['CHANNEL_ID'] = 'WEB';
    params['INDUSTRY_TYPE_ID'] = 'Retail';
    params['ORDER_ID'] = 'TEST_'  + paymentDetails.orderID;
//     params['CUST_ID'] = paymentDetails.customerId;
    params['TXN_AMOUNT'] = paymentDetails.amount;
    params['CALLBACK_URL'] = 'https://zomato-clone-app-payment.herokuapp.com/callback';
    params['EMAIL'] = paymentDetails.customerEmail;
    params['MOBILE_NO'] = paymentDetails.customerPhone;
  

    checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
        var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
        // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production

        var form_fields = "";
        for (var x in params) {
            form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
        }
        form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
        res.end();
    });
}
});
app.post("/callback", (req, res) => {
  // Route for verifiying payment
form.parse(req, (error, fields, file) => { 
        if (error) { 
            console.log(error); 
            res.status(500).json({ error }); 
        } 
 
        const checkSumHash = fields.CHECKSUMHASH; 
        delete fields.CHECKSUMHASH; 
 
        // verify the signature 
 
        const isVerified = PaytmChecksum.verifySignature( 
            fields, 
            config.PaytmConfig.mid, 
            checkSumHash 
        ); 
 
        if (isVerified) { 
            // response is valid 
 
            // get the transaction status from the paytm Server 
            var params = {}; 
            params["MID"] = fields.config.PaytmConfig.mid; 
            params["ORDER_ID"] = fields.ORDERID; 
 
            PaytmChecksum.generateSignature( 
                params, 
                config.PaytmConfig.mid 
            ).then(checksum => { 
                // go to the Paytm Server and get the payment status 
                params["CHECKSUMHASH"] = checksum; 
                const data = JSON.stringify(params); 
 
                const options = { 
                    hostname: "securegw-stage.paytm.in", 
                    port: 443, 
                    path: "/order/status", 
                    method: "POST", 
                    header: { 
                        'Content-Type': 'application/json', 
                        'Content-Length': data.legth 
                    }, 
                    data: data 
                }; 
                var response = ""; 
                var request = https.request(options, (responseFromPaytmServer) => { 
                    responseFromPaytmServer.on('data', (chunk) => { 
                        response += chunk; 
                    }); 
                    responseFromPaytmServer.on('end', () => { 
                        if (JSON.parse(response).STATUS === 'TXN_SUCCESS') { 
                            // Success 
                            //res.send('Payment was SUCCESS'); 
 
                            // (1) Save the order and payment details in MongoDB 
 
                            res.sendFile(__dirname + '/success.html'); 
                        } else { 
                            // FAILURE 
                            //res.send('Payment was FAILURE'); 
 
                            // (1) Save the order and payment details in MongoDB 
                            res.sendFile(__dirname + '/failure.html'); 
                        } 
                    }); 
                }); 
                request.write(data); 
                request.end(); 
            }).catch(error => { 
                res.status(500).json({ 
                    message: "Error in Transaction", 
                    error: error 
                }); 
            }); 
        } else { 
            // response is NOT Valid 
            console.log('Checksum mismatch'); 
            res.status(500).json({ error: "It's a hacker !" }); 
        } 
    })
});

app.listen(PORT, () => {
  console.log(`App is listening on Port ${PORT}`);
});
