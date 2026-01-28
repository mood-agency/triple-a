import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { APIKey, CreateAPIKeyInput, CreateAPIKeyResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export function useAPIKeys() {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all API keys for the current user
   */
  const fetchAPIKeys = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/keys`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const result = await response.json();
      setApiKeys(result.data || []);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
      setApiKeys([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new API key
   */
  const createAPIKey = async (input: CreateAPIKeyInput): Promise<CreateAPIKeyResponse | null> => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create API key');
      }

      const result: CreateAPIKeyResponse = await response.json();

      // Refresh the list
      await fetchAPIKeys();

      return result;
    } catch (err) {
      console.error('Error creating API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to create API key');
      throw err;
    }
  };

  /**
   * Revoke (delete) an API key
   */
  const revokeAPIKey = async (id: string): Promise<boolean> => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/keys/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke API key');
      }

      // Remove from local state
      setApiKeys(prev => prev.filter(key => key.id !== id));

      return true;
    } catch (err) {
      console.error('Error revoking API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
      throw err;
    }
  };

  /**
   * Refresh the API keys list
   */
  const refreshKeys = async () => {
    await fetchAPIKeys();
  };

  // Load API keys on mount and when session changes
  useEffect(() => {
    fetchAPIKeys();
  }, [session?.access_token]);

  return {
    apiKeys,
    loading,
    error,
    createAPIKey,
    revokeAPIKey,
    refreshKeys,
  };
}
