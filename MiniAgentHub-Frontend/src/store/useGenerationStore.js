import { create } from 'zustand';

const useGenerationStore = create((set) => ({
  generatingSessions: new Map(),
  addGeneration: (sessionId, controller) => set((state) => {
    const newMap = new Map(state.generatingSessions);
    newMap.set(sessionId, controller);
    return { generatingSessions: newMap };
  }),
  removeGeneration: (sessionId) => set((state) => {
    const newMap = new Map(state.generatingSessions);
    newMap.delete(sessionId);
    return { generatingSessions: newMap };
  }),
  stopGeneration: (sessionId) => set((state) => {
    const controller = state.generatingSessions.get(sessionId);
    if (controller) {
      controller.abort();
    }
    const newMap = new Map(state.generatingSessions);
    newMap.delete(sessionId);
    return { generatingSessions: newMap };
  })
}));

export default useGenerationStore;
