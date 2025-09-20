// WebGPU type declarations for navigator.gpu
declare global {
  interface Navigator {
    gpu?: GPU;
  }
  
  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  }
  
  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
    forceFallbackAdapter?: boolean;
  }
  
  interface GPUAdapter {
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
    requestAdapterInfo?(): Promise<GPUAdapterInfo>;
  }
  
  interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: GPUFeatureName[];
    requiredLimits?: Record<string, number>;
  }
  
  interface GPUDevice {
    destroy(): void;
  }
  
  interface GPUAdapterInfo {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  }
  
  type GPUFeatureName = string;
}

export {};