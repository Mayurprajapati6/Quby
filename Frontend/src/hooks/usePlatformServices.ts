import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface PlatformService {
  id: string; name: string; description: string | null
  category: string; service_for: 'MEN' | 'UNISEX'
  image_url: string | null; is_active: boolean
}

export function usePlatformServices(serviceFor?: string) {
  const { data: allServices = [], isLoading } = useQuery({
    queryKey: ['owner-platform-services'],
    queryFn: async () => {
      const r = await api.get('/owner/platform-services', { params: { is_active: true } })
      const raw = r.data.data
      return (Array.isArray(raw) ? raw : raw?.services ?? []) as PlatformService[]
    },
    staleTime: 10 * 60_000,
  })

  const filtered = allServices.filter(s => {
    if (!serviceFor || serviceFor === 'UNISEX') return true
    return s.service_for === serviceFor || s.service_for === 'UNISEX'
  })

  return { services: filtered, isLoading }
}
