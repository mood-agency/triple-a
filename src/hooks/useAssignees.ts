// Stub for useAssignees hook - assignees feature not yet implemented in backend
export interface Assignee {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export function useAssignees() {
  const assignees: Assignee[] = [];
  const isLoading = false;

  const addAssignee = async (_name: string, _email?: string) => {
    console.warn('useAssignees: addAssignee not implemented - assignees table does not exist in backend');
    return null;
  };

  const createAssignee = async (name: string, _email?: string): Promise<Assignee> => {
    console.warn('useAssignees: createAssignee not implemented - assignees table does not exist in backend');
    // Return a temporary assignee object
    return {
      id: `temp-${Date.now()}`,
      name,
    };
  };

  const removeAssignee = async (_id: string) => {
    console.warn('useAssignees: removeAssignee not implemented - assignees table does not exist in backend');
  };

  const getAssigneeById = (_id: string): Assignee | undefined => {
    return undefined;
  };

  return {
    assignees,
    isLoading,
    addAssignee,
    createAssignee,
    removeAssignee,
    getAssigneeById,
  };
}
