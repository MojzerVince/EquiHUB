import { useState } from 'react'

export interface LoadingState {
  isLoading: boolean
  error: string | null
}

export const useLoadingState = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    error: null
  })

  const setLoading = (isLoading: boolean) => {
    setLoadingState(prev => ({ ...prev, isLoading }))
  }

  const setError = (error: string | null) => {
    setLoadingState(prev => ({ ...prev, error, isLoading: false }))
  }

  const clearError = () => {
    setLoadingState(prev => ({ ...prev, error: null }))
  }

  return {
    ...loadingState,
    setLoading,
    setError,
    clearError
  }
}
