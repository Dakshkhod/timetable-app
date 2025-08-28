// Mock models for development without database

// Mock User model
class MockUser {
  constructor(data = {}) {
    this._id = data._id || 'mock-user-id-' + Date.now();
    this.name = data.name || data.firstName + ' ' + data.lastName || 'Mock User';
    this.firstName = data.firstName || 'Mock';
    this.lastName = data.lastName || 'User';
    this.email = data.email || 'mock@example.com';
    this.branch = data.branch || 'Computer Science';
    this.year = data.year || 2;
    this.rollNumber = data.rollNumber || 'CS001';
    this.password = data.password; // Store hashed password
    this.isActive = true;
    this.role = 'user';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static findById(id) {
    return Promise.resolve(new MockUser({ _id: id }));
  }

  static findOne(query) {
    // Always return null for registration checks (no existing users)
    return Promise.resolve(null);
  }

  static async create(data) {
    console.log('🎯 Mock User: Creating user with data:', data);
    const bcrypt = require('bcryptjs');
    
    // Hash password if provided
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    const newUser = new MockUser(data);
    console.log('✅ Mock User: User created successfully:', newUser.email);
    return Promise.resolve(newUser);
  }

  static find(query) {
    return Promise.resolve([new MockUser()]);
  }

  save() {
    return Promise.resolve(this);
  }

  async comparePassword(password) {
    const bcrypt = require('bcryptjs');
    try {
      // For mock, compare with stored hash or fallback
      if (this.password) {
        return await bcrypt.compare(password, this.password);
      }
      // Fallback for testing
      return password === 'password123';
    } catch (error) {
      return false;
    }
  }

  getProfile() {
    const userObject = { ...this };
    delete userObject.password;
    return userObject;
  }
}

// Mock Assignment model
class MockAssignment {
  constructor(data = {}) {
    this._id = data._id || 'mock-assignment-id';
    this.title = data.title || 'Mock Assignment';
    this.description = data.description || 'Mock assignment description';
    this.dueDate = data.dueDate || new Date();
    this.userId = data.userId || 'mock-user-id';
    this.completed = data.completed || false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static findById(id) {
    return Promise.resolve(new MockAssignment({ _id: id }));
  }

  static findOne(query) {
    return Promise.resolve(new MockAssignment(query));
  }

  static create(data) {
    return Promise.resolve(new MockAssignment(data));
  }

  static find(query) {
    return Promise.resolve([new MockAssignment()]);
  }

  save() {
    return Promise.resolve(this);
  }
}

// Mock Timetable model
class MockTimetable {
  constructor(data = {}) {
    this._id = data._id || 'mock-timetable-id';
    this.name = data.name || 'Mock Timetable';
    this.schedule = data.schedule || {};
    this.userId = data.userId || 'mock-user-id';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static findById(id) {
    return Promise.resolve(new MockTimetable({ _id: id }));
  }

  static findOne(query) {
    return Promise.resolve(null); // No existing timetables
  }

  static create(data) {
    return Promise.resolve(new MockTimetable(data));
  }

  static find(query) {
    return Promise.resolve([new MockTimetable()]);
  }

  save() {
    return Promise.resolve(this);
  }
}

// Mock PersonalTimetable model
class MockPersonalTimetable {
  constructor(data = {}) {
    this._id = data._id || 'mock-personal-timetable-id';
    this.userId = data.userId || 'mock-user-id';
    this.schedule = data.schedule || {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static findById(id) {
    return Promise.resolve(new MockPersonalTimetable({ _id: id }));
  }

  static findOne(query) {
    return Promise.resolve(null);
  }

  static create(data) {
    return Promise.resolve(new MockPersonalTimetable(data));
  }

  static find(query) {
    return Promise.resolve([new MockPersonalTimetable()]);
  }

  save() {
    return Promise.resolve(this);
  }
}

module.exports = { 
  MockUser, 
  MockAssignment, 
  MockTimetable, 
  MockPersonalTimetable 
};
