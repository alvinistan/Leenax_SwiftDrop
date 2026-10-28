import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'

/** Same shape as ProductCard, so the page does not jump when products arrive. */
export function ProductCardSkeleton() {
  return (
    <Card>
      <Skeleton className="aspect-4/3 rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-11 w-full" />
      </div>
    </Card>
  )
}
