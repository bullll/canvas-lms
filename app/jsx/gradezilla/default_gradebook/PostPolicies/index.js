/*
 * Copyright (C) 2019 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import tz from 'timezone'
import React from 'react'
import ReactDOM from 'react-dom'

import AssignmentPostingPolicyTray from '../../../grading/AssignmentPostingPolicyTray'
import HideAssignmentGradesTray from '../../../grading/HideAssignmentGradesTray'
import PostAssignmentGradesTray from '../../../grading/PostAssignmentGradesTray'

function getSubmission(student, assignmentId) {
  const submission = student[`assignment_${assignmentId}`] || {
    posted_at: null,
    score: null,
    workflow_state: null
  }

  return {
    postedAt: submission.posted_at,
    score: submission.score,
    workflowState: submission.workflow_state
  }
}

export default class PostPolicies {
  constructor(gradebook) {
    this._coursePostPolicy = {postManually: !!gradebook.options.post_manually}
    this._gradebook = gradebook

    this._onGradesPostedOrHidden = this._onGradesPostedOrHidden.bind(this)
    this._onAssignmentPostPolicyUpdated = this._onAssignmentPostPolicyUpdated.bind(this)
  }

  initialize() {
    const $hideContainer = document.getElementById('hide-assignment-grades-tray')
    const bindHideTray = ref => {
      this._hideAssignmentGradesTray = ref
    }
    ReactDOM.render(<HideAssignmentGradesTray ref={bindHideTray} />, $hideContainer)

    const $postContainer = document.getElementById('post-assignment-grades-tray')
    const bindPostTray = ref => {
      this._postAssignmentGradesTray = ref
    }
    ReactDOM.render(<PostAssignmentGradesTray ref={bindPostTray} />, $postContainer)

    const $assignmentPolicyContainer = document.getElementById('assignment-posting-policy-tray')
    const bindAssignmentPolicyTray = ref => {
      this._assignmentPolicyTray = ref
    }
    ReactDOM.render(
      <AssignmentPostingPolicyTray ref={bindAssignmentPolicyTray} />,
      $assignmentPolicyContainer
    )
  }

  destroy() {
    ReactDOM.unmountComponentAtNode(document.getElementById('assignment-posting-policy-tray'))
    ReactDOM.unmountComponentAtNode(document.getElementById('hide-assignment-grades-tray'))
    ReactDOM.unmountComponentAtNode(document.getElementById('post-assignment-grades-tray'))
  }

  _onGradesPostedOrHidden({assignmentId, postedAt, userIds}) {
    const assignment = this._gradebook.getAssignment(assignmentId)
    const parsedPostedAt = tz.parse(postedAt)

    userIds.forEach(userId => {
      const submission = this._gradebook.getSubmission(userId, assignmentId)
      submission.posted_at = parsedPostedAt
      this._gradebook.updateSubmission(submission)
    })

    if (assignment.anonymous_grading) {
      assignment.anonymize_students = !postedAt
    }

    this._gradebook.handleSubmissionPostedChange(assignment)
  }

  _onAssignmentPostPolicyUpdated({assignmentId, postManually}) {
    const assignment = this._gradebook.getAssignment(assignmentId)
    assignment.post_manually = postManually

    const columnId = this._gradebook.getAssignmentColumnId(assignmentId)
    this._gradebook.updateColumnHeaders([columnId])
  }

  showAssignmentPostingPolicyTray({assignmentId, onExited}) {
    const assignment = this._gradebook.getAssignment(assignmentId)
    const {id, name} = assignment

    this._assignmentPolicyTray.show({
      assignment: {
        anonymousGrading: assignment.anonymous_grading,
        gradesPublished: assignment.grades_published,
        id,
        moderatedGrading: assignment.moderated_grading,
        name,
        postManually: assignment.post_manually
      },
      onAssignmentPostPolicyUpdated: this._onAssignmentPostPolicyUpdated,
      onExited
    })
  }

  showHideAssignmentGradesTray({assignmentId, onExited}) {
    const assignment = this._gradebook.getAssignment(assignmentId)
    const {anonymous_grading, grades_published, id, name} = assignment
    const sections = this._gradebook.getSections()

    this._hideAssignmentGradesTray.show({
      assignment: {
        anonymousGrading: anonymous_grading,
        gradesPublished: grades_published,
        id,
        name
      },
      onExited,
      onHidden: this._onGradesPostedOrHidden,
      sections
    })
  }

  showPostAssignmentGradesTray({assignmentId, onExited = () => {}}) {
    const assignment = this._gradebook.getAssignment(assignmentId)
    const {anonymous_grading, grades_published, id, name} = assignment
    const sections = this._gradebook.getSections()
    const studentsWithVisibility = Object.values(
      this._gradebook.studentsThatCanSeeAssignment(assignment.id)
    )
    const submissions = studentsWithVisibility.map(student => getSubmission(student, assignment.id))

    this._postAssignmentGradesTray.show({
      assignment: {
        anonymousGrading: anonymous_grading,
        gradesPublished: grades_published,
        id,
        name
      },
      onExited: () => {
        this._gradebook.postAssignmentGradesTrayOpenChanged({
          assignmentId: assignment.id,
          isOpen: false
        })
        onExited()
      },
      sections,
      submissions,
      onPosted: this._onGradesPostedOrHidden
    })

    this._gradebook.postAssignmentGradesTrayOpenChanged({
      assignmentId: assignment.id,
      isOpen: true
    })
  }

  get coursePostPolicy() {
    return this._coursePostPolicy
  }

  setCoursePostPolicy({postManually}) {
    this._coursePostPolicy = {postManually}
  }

  setAssignmentPostPolicies({assignmentPostPoliciesById}) {
    Object.entries(assignmentPostPoliciesById).forEach(([id, postPolicy]) => {
      const assignment = this._gradebook.getAssignment(id)
      if (assignment != null) {
        assignment.post_manually = postPolicy.postManually
      }
    })

    // The changed assignments may not all be visible, so update all column
    // headers rather than worrying about which ones are or aren't shown
    this._gradebook.updateColumnHeaders()
  }
}
