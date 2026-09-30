import React from 'react';
import { Users, UserCheck, CheckCircle2, RotateCcw } from 'lucide-react';

export default function MetricCards({ metrics, students = [] }) {
  // Live dynamic calculation directly from active student records
  const studentList = Array.isArray(students) ? students : [];

  const total = studentList.length > 0 
    ? studentList.length 
    : (metrics?.totalStudents ?? metrics?.total ?? 0);

  const allocated = studentList.length > 0
    ? studentList.filter(s => 
        s.status === 'Allocated' || 
        s.allocationStatus === 'allocated' || 
        !!s.allocatedTeacher || 
        !!s.allocatedTeacherName || 
        !!s.allocatedTeacherId
      ).length
    : (metrics?.allocatedStudents ?? metrics?.allocated ?? 0);

  const evaluated = studentList.length > 0
    ? studentList.filter(s => 
        s.status === 'Evaluated' || 
        s.evaluationStatus === 'checked' || 
        s.evaluationStatus === 'evaluated' || 
        !!s.evaluation || 
        (s.totalScore !== undefined && s.totalScore > 0)
      ).length
    : (metrics?.evaluatedStudents ?? metrics?.checked ?? metrics?.evaluated ?? 0);

  const sentForEvaluation = studentList.length > 0
    ? studentList.filter(s => 
        s.inRevaluation || 
        s.status === 'Sent for Revaluation' || 
        s.evaluationStatus === 'revaluation' || 
        !!s.revaluation
      ).length
    : (metrics?.sentForEvaluation ?? metrics?.revaluation ?? 0);

  return (
    <div className="metrics-grid">
      {/* 1. Total Students */}
      <div className="stat-box liquid-glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-box-label">Total Students</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} color="#FC6C26" />
          </div>
        </div>
        <span className="stat-box-value">{total}</span>
        <span className="stat-box-subtext">Active answer script records in archive</span>
      </div>

      {/* 2. Allocated Students */}
      <div className="stat-box liquid-glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-box-label">Allocated Students</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={18} color="#FC6C26" />
          </div>
        </div>
        <span className="stat-box-value">
          {allocated}
        </span>
        <span className="stat-box-subtext">Assigned to authorized evaluator faculty</span>
      </div>

      {/* 3. Checked / Evaluated */}
      <div className="stat-box liquid-glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-box-label">Checked / Evaluated</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} color="#FC6C26" />
          </div>
        </div>
        <span className="stat-box-value">
          {evaluated}
        </span>
        <span className="stat-box-subtext">Grading completed and marks submitted</span>
      </div>

      {/* 4. Sent for Evaluation (Revaluation) */}
      <div className="stat-box liquid-glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-box-label">Sent for Evaluation</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={18} color="#FC6C26" />
          </div>
        </div>
        <span className="stat-box-value">
          {sentForEvaluation}
        </span>
        <span className="stat-box-subtext">In scrutiny / revaluation queue</span>
      </div>
    </div>
  );
}
