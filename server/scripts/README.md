# Timetable Management Scripts

This directory contains scripts to help manage timetables and resolve common issues.

## Available Scripts

### 1. `removeDuplicateClasses.js`
**Purpose**: Automatically removes duplicate classes from all personal timetables.

**What it does**:
- Finds classes with the same subject, day, and time slot
- Keeps the first occurrence and removes duplicates
- Works across all users' personal timetables

**Usage**:
```bash
cd server/scripts
node removeDuplicateClasses.js
```

**Use case**: When users accidentally add the same class multiple times.

### 2. `removeSpecificClasses.js`
**Purpose**: Removes specific classes based on exact criteria.

**What it does**:
- Removes classes matching specific subject, day, and time
- Configurable list of classes to remove
- Safe and targeted removal

**Usage**:
```bash
cd server/scripts
node removeSpecificClasses.js
```

**Configuration**: Edit the `classesToRemove` array in the script to specify which classes to remove.

**Example**:
```javascript
const classesToRemove = [
  {
    subject: 'IAM',
    day: 'Monday',
    startTime: '21:00',
    endTime: '21:50'
  }
];
```

**Use case**: When you need to remove specific duplicate classes (like your duplicate IAM classes).

### 3. `clearTimetables.js`
**Purpose**: Clears all fixed timetables (admin-created ones).

**What it does**:
- Removes all branch/year timetables
- Users start with blank personal timetables
- Useful for resetting the system

**Usage**:
```bash
cd server/scripts
node clearTimetables.js
```

**Use case**: When you want to start fresh with no predefined timetables.

### 4. `seedTimetables.js`
**Purpose**: Creates admin users and initial setup.

**What it does**:
- Creates admin users for each branch
- Sets up the basic user structure
- No fixed timetables are created

**Usage**:
```bash
cd server/scripts
node seedTimetables.js
```

**Use case**: Initial setup or resetting admin users.

## Frontend Delete Functionality

The frontend now includes delete buttons for all classes (not just custom ones). Users can:

1. **Edit any class**: Click the edit (pencil) icon
2. **Delete any class**: Click the delete (trash) icon
3. **Confirmation**: Delete actions show a confirmation dialog

## Quick Fix for Duplicate IAM Classes

To quickly remove your duplicate IAM classes:

1. **Option 1**: Use the frontend
   - Go to your timetable
   - Find the duplicate IAM class
   - Click the delete (trash) icon
   - Confirm deletion

2. **Option 2**: Use the script
   ```bash
   cd server/scripts
   node removeSpecificClasses.js
   ```

## Safety Features

- All scripts include confirmation logging
- Scripts show exactly what will be removed
- Database connections are properly closed
- Error handling prevents data corruption

## Prerequisites

- MongoDB running
- Environment variables set (MONGODB_URI)
- Node.js installed
- Dependencies installed (`npm install` in server directory)

## Notes

- Scripts affect **personal timetables** (user-created schedules)
- Fixed timetables (admin-created) are not affected by these scripts
- Always backup your database before running scripts in production
- Scripts are safe to run multiple times
