//Imports
const sls = require('serverless-http');
const express = require('express');
const app = express();
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

//Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//Connect
const url = `YOUR_MONGO_CONNECTION_URL`;
mongoose.connect(url);

//Schemas
const MessageSchema = new mongoose.Schema({
  message: { type: String, required: true },
});

const CustomerSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: String,
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },  
  messages: [MessageSchema],
});

//Models
const Customer = mongoose.model('Customer', CustomerSchema);
const Message = mongoose.model('Message', MessageSchema);

//Routes
const router = express.Router();

//Create a document
router.post('/', asyncHandler(async(req, res, next) => {
  const customer = await Customer.create(req.body);
  res.status(200).send(customer);
}));

//Get collection
router.get('/', asyncHandler(async(req, res, next) => {
  const customers = await Customer.find();
  res.status(200).send(customers);
}));

//Get a single document
router.get('/:id', asyncHandler(async(req, res, next) => {
  const { id } = req.params;
  const customer = await Customer.findById(id);

  if (!customer || Object.keys(customer).length === 0) {
    throw createError(404, `A customer with the id = ${id} does not exist`);
  } else {
    res.status(200).send(customer);
  }
}));

//Update a document
router.put('/', asyncHandler(async(req, res, next) => {
  const { _id } = req.body;

  const customer = await Customer.findOneAndUpdate(
    { _id: _id },
    { $set: req.body },
    { new : true },
  );

  res.status(200).send(customer);
}));

//Delete a document
router.delete('/:id', asyncHandler(async(req, res, next) => {
  const { id } = req.params;

  await Customer.remove({ _id: id });
  res.status(200).end();
}));

//Send SMS
//pass in the id in the request queryparam as `/send/?id=12345`
router.post('/send', asyncHandler(async (req, res, next) => {
  const { id } = req.query;

  AWS.config.update({ region: 'us-east-1'});

  const SNS = new AWS.SNS( { apiVersion: '2010-03-31'});
  const customer = await Customer.findById(id);

  if (!customer || Object.keys(customer).length === 0) {
    throw createError(404, 'Customer with that id was not found');
  } else {
    const payload = {
      Message: req.body.message,
      PhoneNumber: customer.phoneNumber,
    }

    const response = await SNS.publish(payload).promise();
    res.status(200).send(response);
  }
}));

app.use('/customers', router);

//Errors
app.use((req, res, next) => {
  next(createError(404));
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);

  res.json({
    message: error.message,
    status: error.status,
  });
});

//Export app
module.exports.run = sls(app)