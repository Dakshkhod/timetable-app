// Mock User model for development without database
class MockUser {
  constructor(data = {}) {
    this._id = data._id || 'mock-user-id';
    this.name = data.name || 'Mock User';
    this.email = data.email || 'mock@example.com';
    this.branch = data.branch || 'Computer Science';
    this.year = data.year || 2;
    this.rollNumber = data.rollNumber || 'CS001';
    this.isActive = true;
    this.role = 'user';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static findById(id) {
    return Promise.resolve(new MockUser({ _id: id }));
  }

  static findOne(query) {
    return Promise.resolve(new MockUser(query));
  }

  static create(data) {
    return Promise.resolve(new MockUser(data));
  }

  static find(query) {
    return Promise.resolve([new MockUser()]);
  }

  save() {
    return Promise.resolve(this);
  }

  comparePassword(password) {
    return Promise.resolve(password === 'password123');
  }

  getProfile() {
    const userObject = { ...this };
    delete userObject.password;
    return userObject;
  }
}

module.exports = MockUser;
