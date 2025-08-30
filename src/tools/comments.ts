// src/tools/comments.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";

/**
 * Enhanced Comments API Tools
 * 
 * Leverages OpenProject's latest internal comments capabilities including:
 * - Capabilities API checking for comment permissions
 * - Internal vs public comment support
 * - Enhanced security for team discussions
 */

// Check comment capabilities for a work package
export const checkCommentCapabilitiesInput = z.object({
  workPackageId: z.union([z.string(), z.number()])
    .describe("Work package ID to check comment capabilities for")
}).strict();

export async function checkCommentCapabilities({ env }: Ctx, input: z.infer<typeof checkCommentCapabilitiesInput>) {
  try {
    // Get work package with capabilities
    const { json: workPackage } = await opFetch<any>(env, `/api/v3/work_packages/${input.workPackageId}`);
    
    const capabilities = {
      workPackageId: input.workPackageId,
      canComment: false,
      canCreateInternalComments: false,
      canViewInternalComments: false,
      canEditComments: false,
      canDeleteComments: false,
      availableActivities: [] as string[]
    };
    
    // Check available capabilities from _links
    if (workPackage?._links) {
      const links = workPackage._links;
      
      // Check if user can add activities (comments)
      if (links.addComment || links.activities) {
        capabilities.canComment = true;
      }
      
      // Check specific internal comment capabilities
      if (links.addInternalComment) {
        capabilities.canCreateInternalComments = true;
      }
      
      // Check edit capabilities
      if (links.update || links.updateImmediately) {
        capabilities.canEditComments = true;
      }
    }
    
    // Get available activity types via capabilities API
    try {
      const { json: activitiesForm } = await opFetch<any>(
        env, 
        `/api/v3/work_packages/${input.workPackageId}/activities/form`
      );
      
      if (activitiesForm?._embedded?.schema?.activity?._embedded?.allowedValues) {
        capabilities.availableActivities = activitiesForm._embedded.schema.activity._embedded.allowedValues
          .map((activity: any) => activity.name || activity.id);
      }
      
      // Check for internal comment type
      if (capabilities.availableActivities.includes('Internal comment')) {
        capabilities.canCreateInternalComments = true;
      }
      
    } catch (error) {
      // Form might not be available, capabilities already checked via _links
    }
    
    return capabilities;
    
  } catch (error: any) {
    return {
      workPackageId: input.workPackageId,
      error: `Failed to check capabilities: ${error.message}`,
      canComment: false,
      canCreateInternalComments: false,
      canViewInternalComments: false,
      canEditComments: false,
      canDeleteComments: false,
      availableActivities: []
    };
  }
}

// Add internal comment to work package
export const addInternalCommentInput = z.object({
  workPackageId: z.union([z.string(), z.number()])
    .describe("Work package ID to add comment to"),
  comment: z.string().min(1)
    .describe("Comment text"),
  format: z.enum(['markdown', 'textile', 'plain']).default('markdown')
    .describe("Comment format"),
  internal: z.boolean().default(true)
    .describe("Make comment internal (visible only to team members)"),
  notifyWatchers: z.boolean().default(false)
    .describe("Notify watchers about this internal comment")
}).strict();

export async function addInternalComment({ env }: Ctx, input: z.infer<typeof addInternalCommentInput>) {
  try {
    // First check capabilities
    const capabilities = await checkCommentCapabilities({ env }, { workPackageId: input.workPackageId });
    
    if (!capabilities.canCreateInternalComments && input.internal) {
      return {
        success: false,
        error: "User does not have permission to create internal comments",
        capabilities
      };
    }
    
    if (!capabilities.canComment) {
      return {
        success: false,
        error: "User does not have permission to add comments",
        capabilities
      };
    }
    
    const payload = {
      comment: {
        format: input.format,
        raw: input.comment
      },
      notify: input.notifyWatchers
    };
    
    // Add internal comment type if available and requested
    if (input.internal && capabilities.availableActivities.includes('Internal comment')) {
      (payload as any).activity = {
        href: `/api/v3/activity/${capabilities.availableActivities.indexOf('Internal comment')}`
      };
    }
    
    // Create form first to validate
    const { json: form } = await opFetch<any>(
      env, 
      `/api/v3/work_packages/${input.workPackageId}/activities/form`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    
    if (form?.validationErrors && Object.keys(form.validationErrors).length > 0) {
      return {
        success: false,
        error: "Comment validation failed",
        validationErrors: form.validationErrors,
        capabilities
      };
    }
    
    // Commit the comment
    if (form?._links?.commit) {
      const { json: result } = await opFetch<any>(env, form._links.commit.href, {
        method: form._links.commit.method || 'POST',
        body: JSON.stringify(form.payload)
      });
      
      return {
        success: true,
        comment: {
          id: result?.id,
          workPackageId: input.workPackageId,
          comment: input.comment,
          internal: input.internal,
          createdAt: result?.createdAt,
          user: result?._links?.user,
          activity: result
        },
        capabilities
      };
    }
    
    return {
      success: false,
      error: "Could not create comment - no commit link available",
      capabilities
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

// List comments with internal/public filtering
export const listCommentsInput = z.object({
  workPackageId: z.union([z.string(), z.number()])
    .describe("Work package ID to get comments for"),
  includeInternal: z.boolean().default(true)
    .describe("Include internal comments (requires permission)"),
  includePublic: z.boolean().default(true)
    .describe("Include public comments"),
  sortBy: z.array(z.tuple([
    z.enum(['id', 'createdAt', 'updatedAt']),
    z.enum(['asc', 'desc'])
  ])).default([['createdAt', 'desc']]).describe("Sort activities"),
  pageSize: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
}).strict();

export async function listComments({ env }: Ctx, input: z.infer<typeof listCommentsInput>) {
  try {
    // Check capabilities first
    const capabilities = await checkCommentCapabilities({ env }, { workPackageId: input.workPackageId });
    
    const params: any = {
      pageSize: input.pageSize,
      offset: input.offset,
      sortBy: JSON.stringify(input.sortBy)
    };
    
    // Build filters for comment types
    const filters: any[] = [];
    
    if (!input.includeInternal || !capabilities.canViewInternalComments) {
      // Exclude internal comments if not requested or no permission
      filters.push({
        type: { operator: '!', values: ['Activity::Comment-Internal'] }
      });
    }
    
    if (!input.includePublic) {
      // Exclude public comments if not requested
      filters.push({
        type: { operator: '!', values: ['Activity::Comment'] }
      });
    }
    
    if (filters.length > 0) {
      params.filters = JSON.stringify(filters);
    }
    
    const { json } = await opFetch<any>(env, `/api/v3/work_packages/${input.workPackageId}/activities`, { params });
    
    const activities = json?._embedded?.elements || [];
    
    // Filter and categorize comments
    const comments = activities
      .filter((activity: any) => 
        activity._type === 'Activity::Comment' || 
        activity._type === 'Activity::Comment-Internal'
      )
      .map((activity: any) => ({
        id: activity.id,
        type: activity._type,
        internal: activity._type === 'Activity::Comment-Internal',
        comment: activity.comment,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
        user: activity._links?.user,
        canEdit: !!activity._links?.update,
        canDelete: !!activity._links?.delete,
        _links: activity._links
      }));
    
    return {
      workPackageId: input.workPackageId,
      comments,
      total: json?.total || 0,
      count: comments.length,
      pageSize: input.pageSize,
      offset: input.offset,
      capabilities,
      _links: json?._links
    };
    
  } catch (error: any) {
    return {
      workPackageId: input.workPackageId,
      error: error.message,
      comments: [],
      capabilities: null
    };
  }
}

// Update/edit a comment (if user has permission)
export const updateCommentInput = z.object({
  workPackageId: z.union([z.string(), z.number()])
    .describe("Work package ID"),
  commentId: z.union([z.string(), z.number()])
    .describe("Comment/activity ID to update"),
  comment: z.string().min(1)
    .describe("Updated comment text"),
  format: z.enum(['markdown', 'textile', 'plain']).default('markdown')
    .describe("Comment format")
}).strict();

export async function updateComment({ env }: Ctx, input: z.infer<typeof updateCommentInput>) {
  try {
    // Check if the specific comment can be edited
    const { json: activity } = await opFetch<any>(env, `/api/v3/activities/${input.commentId}`);
    
    if (!activity?._links?.update) {
      return {
        success: false,
        error: "User does not have permission to edit this comment",
        commentId: input.commentId
      };
    }
    
    const payload = {
      comment: {
        format: input.format,
        raw: input.comment
      }
    };
    
    // Update the comment
    const { json: result } = await opFetch<any>(env, activity._links.update.href, {
      method: activity._links.update.method || 'PATCH',
      body: JSON.stringify(payload)
    });
    
    return {
      success: true,
      comment: {
        id: result?.id || input.commentId,
        workPackageId: input.workPackageId,
        comment: input.comment,
        updatedAt: result?.updatedAt,
        internal: result?._type === 'Activity::Comment-Internal',
        activity: result
      }
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      commentId: input.commentId
    };
  }
}

// Delete a comment (if user has permission)
export const deleteCommentInput = z.object({
  workPackageId: z.union([z.string(), z.number()])
    .describe("Work package ID"),
  commentId: z.union([z.string(), z.number()])
    .describe("Comment/activity ID to delete")
}).strict();

export async function deleteComment({ env }: Ctx, input: z.infer<typeof deleteCommentInput>) {
  try {
    // Check if the specific comment can be deleted
    const { json: activity } = await opFetch<any>(env, `/api/v3/activities/${input.commentId}`);
    
    if (!activity?._links?.delete) {
      return {
        success: false,
        error: "User does not have permission to delete this comment",
        commentId: input.commentId
      };
    }
    
    // Delete the comment
    await opFetch<any>(env, activity._links.delete.href, {
      method: activity._links.delete.method || 'DELETE'
    });
    
    return {
      success: true,
      commentId: input.commentId,
      workPackageId: input.workPackageId,
      deletedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      commentId: input.commentId
    };
  }
}