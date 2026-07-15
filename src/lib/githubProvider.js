import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

const functions = getFunctions(app);
const getRepoTreeFn = httpsCallable(functions, 'getRepoTree');
const getRepoFileFn = httpsCallable(functions, 'getRepoFile');
const proposeRepoChangesFn = httpsCallable(functions, 'proposeRepoChanges');
const approveRepoChangesFn = httpsCallable(functions, 'approveRepoChanges');

export const GitHubProvider = {
  async getRepoTree({ owner, repo, branch } = {}) {
    const { data } = await getRepoTreeFn({ owner, repo, branch });
    return data;
  },

  async getRepoFile({ owner, repo, path, branch } = {}) {
    const { data } = await getRepoFileFn({ owner, repo, path, branch });
    return data;
  },

  async proposeRepoChanges({ owner, repo, baseBranch, title, description, reason, changes } = {}) {
    const { data } = await proposeRepoChangesFn({ owner, repo, baseBranch, title, description, reason, changes });
    return data;
  },

  async approveRepoChanges({ audit_id } = {}) {
    const { data } = await approveRepoChangesFn({ audit_id });
    return data;
  },
};
