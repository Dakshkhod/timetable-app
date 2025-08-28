const { createClassroomClient, createDriveClient } = require('../config/google');

class GoogleClassroomService {
  constructor(accessToken) {
    this.classroom = createClassroomClient(accessToken);
    this.drive = createDriveClient(accessToken);
  }

  // Fetch user's courses
  async getCourses() {
    try {
      // Many Classroom accounts are students, some are teachers.
      // Try student view first, then teacher view. Merge and de-duplicate.
      const [asStudent, asTeacher] = await Promise.all([
        this.classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 100, studentId: 'me' }).catch(() => ({ data: {} })),
        this.classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 100, teacherId: 'me' }).catch(() => ({ data: {} })),
      ]);

      const studentCourses = asStudent.data?.courses || [];
      const teacherCourses = asTeacher.data?.courses || [];

      const combined = [...studentCourses, ...teacherCourses];
      const uniqueById = Object.values(
        combined.reduce((acc, c) => {
          if (!acc[c.id]) acc[c.id] = c;
          return acc;
        }, {})
      );

      return uniqueById;
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw new Error('Failed to fetch Google Classroom courses');
    }
  }

  // Fetch assignments from a specific course
  async getCourseAssignments(courseId) {
    try {
      const response = await this.classroom.courses.courseWork.list({
        courseId: courseId,
        pageSize: 50,
        orderBy: 'dueDate desc'
      });
      
      const assignments = response.data.courseWork || [];
      
      // Fetch detailed information for each assignment
      const detailedAssignments = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            // Get submission details
            const submissionResponse = await this.classroom.courses.courseWork.studentSubmissions.list({
              courseId: courseId,
              courseWorkId: assignment.id
            });
            
            const submission = submissionResponse.data.studentSubmissions?.[0];
            
            // Build proper JS Date from Classroom's dueDate (Y/M/D) and dueTime (H:M)
            const buildDueDate = () => {
              if (!assignment.dueDate) return null;
              const { year, month, day } = assignment.dueDate;
              const hours = assignment.dueTime?.hours || 0;
              const minutes = assignment.dueTime?.minutes || 0;
              // month is 1-based in API, 0-based in JS Date
              try {
                return new Date(year, (month || 1) - 1, day || 1, hours, minutes);
              } catch (_) {
                return null;
              }
            };

            return {
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              alternateLink: assignment.alternateLink,
              dueDate: buildDueDate(),
              maxPoints: assignment.maxPoints,
              workType: assignment.workType,
              state: assignment.state,
              submission: submission ? {
                id: submission.id,
                state: submission.state,
                late: submission.late,
                assignedGrade: submission.assignedGrade
              } : null,
              materials: assignment.materials || [],
              createdAt: new Date(assignment.creationTime)
            };
          } catch (error) {
            console.error(`Error fetching details for assignment ${assignment.id}:`, error);
            return null;
          }
        })
      );
      
      return detailedAssignments.filter(assignment => assignment !== null);
    } catch (error) {
      console.error('Error fetching course assignments:', error);
      throw new Error('Failed to fetch course assignments');
    }
  }

  // Fetch all assignments from all courses
  async getAllAssignments() {
    try {
      const courses = await this.getCourses();
      // Fetch assignments for all courses in parallel to reduce total time
      const perCourseResults = await Promise.all(
        courses.map(async (course) => {
          try {
            const courseAssignments = await this.getCourseAssignments(course.id);
            return courseAssignments.map((assignment) => ({
              ...assignment,
              course: {
                id: course.id,
                name: course.name,
                section: course.section,
                room: course.room,
              },
            }));
          } catch (error) {
            console.error(`Error fetching assignments for course ${course.id}:`, error);
            return [];
          }
        })
      );

      return perCourseResults.flat();
    } catch (error) {
      console.error('Error fetching all assignments:', error);
      throw new Error('Failed to fetch all assignments');
    }
  }

  // Fetch course materials and resources
  async getCourseMaterials(courseId) {
    try {
      const response = await this.classroom.courses.courseWorkMaterials.list({
        courseId: courseId,
        pageSize: 50
      });
      
      return response.data.courseWorkMaterial || [];
    } catch (error) {
      console.error('Error fetching course materials:', error);
      throw new Error('Failed to fetch course materials');
    }
  }

  // Get file details from Google Drive
  async getFileDetails(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,size,mimeType,webViewLink,thumbnailLink,modifiedTime'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching file details:', error);
      throw new Error('Failed to fetch file details');
    }
  }

  // Download file content (for text-based files)
  async downloadFile(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  }

  // Get user profile information
  async getUserProfile() {
    try {
      const response = await this.classroom.userProfiles.get({
        userId: 'me'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  // Check if user has access to a specific course
  async hasCourseAccess(courseId) {
    try {
      await this.classroom.courses.get({ id: courseId });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get upcoming assignments (due within next 7 days)
  async getUpcomingAssignments() {
    try {
      const allAssignments = await this.getAllAssignments();
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      return allAssignments.filter(assignment => {
        if (!assignment.dueDate) return false;
        const dueDate = new Date(assignment.dueDate);
        return dueDate >= now && dueDate <= weekFromNow;
      }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } catch (error) {
      console.error('Error fetching upcoming assignments:', error);
      throw new Error('Failed to fetch upcoming assignments');
    }
  }

  // Get overdue assignments
  async getOverdueAssignments() {
    try {
      const allAssignments = await this.getAllAssignments();
      const now = new Date();
      
      return allAssignments.filter(assignment => {
        if (!assignment.dueDate) return false;
        const dueDate = new Date(assignment.dueDate);
        return dueDate < now && assignment.submission?.state !== 'TURNED_IN';
      }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } catch (error) {
      console.error('Error fetching overdue assignments:', error);
      throw new Error('Failed to fetch overdue assignments');
    }
  }

  // Fetch recent announcements for a course
  async getCourseAnnouncements(courseId, pageSize = 10) {
    try {
      const response = await this.classroom.courses.announcements.list({
        courseId,
        pageSize,
        orderBy: 'updateTime desc',
      });
      const anns = response.data.announcements || [];
      return anns.map((a) => ({
        id: a.id,
        text: a.text || '',
        materials: a.materials || [],
        state: a.state,
        alternateLink: a.alternateLink,
        createdAt: a.creationTime ? new Date(a.creationTime) : null,
        updatedAt: a.updateTime ? new Date(a.updateTime) : null,
      }));
    } catch (error) {
      console.error('Error fetching course announcements:', error);
      throw new Error('Failed to fetch course announcements');
    }
  }

  // Fetch recent announcements across all courses
  async getAllAnnouncements(limitPerCourse = 5) {
    const courses = await this.getCourses();
    const perCourse = await Promise.all(
      courses.map(async (c) => {
        try {
          const anns = await this.getCourseAnnouncements(c.id, limitPerCourse);
          return anns.map((a) => ({
            ...a,
            course: { id: c.id, name: c.name, section: c.section },
          }));
        } catch (e) {
          return [];
        }
      })
    );
    return perCourse.flat().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }
}

module.exports = GoogleClassroomService;
