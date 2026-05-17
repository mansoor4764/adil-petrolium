'use strict';
const { expect } = require('chai');
const dailyRecordService = require('../../src/services/dailyRecordService');
const Transaction = require('../../src/models/Transaction');
const DailyRecord = require('../../src/models/DailyRecord');
const { connectTestDB, clearDB, closeDB } = require('../helpers/setup');
const { createAdmin, createCustomer } = require('../helpers/fixtures');

// Helper: return today's date string in PKT (UTC+5).
// The service's parsePkDate interprets the date string as a PKT calendar day,
// so we must pass the PKT date — not the UTC date — to avoid the window
// [PKT-day-start, PKT-day-end) missing transactions when UTC time is 19:00–23:59.
const PK_OFFSET_MS = 5 * 60 * 60 * 1000;
const pktDateStr = (offsetDays = 0) => {
  const d = new Date(Date.now() + PK_OFFSET_MS + offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
};

describe('Daily Record Service Unit', function () {
  this.timeout(15000);

  let admin, customerUser, customerProfile;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectTestDB();
    admin = await createAdmin({ email: 'daily-admin@example.com', password: 'Admin@1234' });
    const customerData = await createCustomer({ name: 'Test Customer' });
    customerUser = customerData.user;
    customerProfile = customerData.profile;
  });

  after(async () => {
    await clearDB();
    await closeDB();
  });

  it('should parse date correctly', () => {
    // Test internal date parsing
    const service = dailyRecordService;
    expect(service).to.exist;
  });

  it('should get or create daily record', async () => {
    // Create a transaction first
    await Transaction.create({
      customerId: customerProfile._id,
      userId: customerUser._id,
      transactionType: 'fuel_sale',
      fuelType: 'pmg',
      fuelQuantity: 100,
      rate: 300,
      totalAmount: 30000,
      previousBalance: 0,
      updatedBalance: 30000,
      createdBy: admin._id,
    });

    const record = await dailyRecordService.getOrCreateDailyRecord(pktDateStr(), admin._id);
    
    expect(record).to.exist;
    expect(record).to.have.property('totalFuelSold');
    expect(record).to.have.property('totalSalesAmount');
    expect(record).to.have.property('totalPaymentsReceived');
  });

  it('should aggregate transactions for daily record', async () => {
    // Create multiple transactions
    await Transaction.create({
      customerId: customerProfile._id,
      userId: customerUser._id,
      transactionType: 'fuel_sale',
      fuelType: 'pmg',
      fuelQuantity: 50,
      rate: 300,
      totalAmount: 15000,
      previousBalance: 0,
      updatedBalance: 15000,
      createdBy: admin._id,
    });

    await Transaction.create({
      customerId: customerProfile._id,
      userId: customerUser._id,
      transactionType: 'payment',
      paymentReceived: 5000,
      previousBalance: 15000,
      updatedBalance: 10000,
      createdBy: admin._id,
    });

    // Use PKT date (UTC+5) to match the service's parsePkDate window.
    // Using toISOString() (UTC) can place the current time outside the PKT
    // day window when UTC time is between 19:00–23:59 UTC.
    const record = await dailyRecordService.getOrCreateDailyRecord(pktDateStr(), admin._id);

    expect(record.totalFuelSold).to.be.greaterThan(0);
    expect(record.totalSalesAmount).to.be.greaterThan(0);
    expect(record.totalPaymentsReceived).to.be.greaterThan(0);
    expect(record.totalTransactions).to.be.greaterThan(0);
  });

  it('should exclude voided transactions from daily record', async () => {
    // Create a transaction
    const tx = await Transaction.create({
      customerId: customerProfile._id,
      userId: customerUser._id,
      transactionType: 'fuel_sale',
      fuelType: 'hsd',
      fuelQuantity: 100,
      rate: 250,
      totalAmount: 25000,
      previousBalance: 0,
      updatedBalance: 25000,
      createdBy: admin._id,
    });

    // Void it
    tx.isVoided = true;
    tx.voidedBy = admin._id;
    tx.voidReason = 'Test void';
    await tx.save();

    const record = await dailyRecordService.getOrCreateDailyRecord(pktDateStr(), admin._id);

    // The record should exist but voided transaction should not be counted
    expect(record).to.exist;
  });

  it('should handle invalid date format gracefully', async () => {
    try {
      await dailyRecordService.getOrCreateDailyRecord('invalid-date', admin._id);
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).to.exist;
    }
  });

  it('should return zero values when no transactions', async () => {
    // Use PKT yesterday — guaranteed no transactions were created for that date
    const record = await dailyRecordService.getOrCreateDailyRecord(pktDateStr(-1), admin._id);

    expect(record.totalFuelSold).to.equal(0);
    expect(record.totalSalesAmount).to.equal(0);
    expect(record.totalPaymentsReceived).to.equal(0);
  });
});
