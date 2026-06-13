import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CameraStore {
  permissionGranted: boolean
  setPermissionGranted: (v: boolean) => void
}

export const useCameraStore = create<CameraStore>()(persist(
  set => ({
    permissionGranted: false,
    setPermissionGranted: v => set({ permissionGranted: v }),
  }),
  { name: 'quby-staff-camera-v1', storage: createJSONStorage(() => localStorage) }
))
