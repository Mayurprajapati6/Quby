import { useParams } from 'react-router-dom'

export function useBusinessId(): string {
  const { businessId: paramId } = useParams<{ businessId?: string }>()
  if (paramId) return paramId
  return new URLSearchParams(window.location.search).get('businessId') ?? ''
}
