/**
 * Product Fitment Widget
 * 
 * Displays and manages vehicle fitments for a product in the Medusa Admin.
 * Injected into the product details page.
 */
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

interface Fitment {
  id: string
  vehicle_id: string
  position: string | null
  vehicle?: {
    id: string
    name: string
    year_from: number
    year_to: number | null
    model?: {
      name: string
      make?: {
        name: string
      }
    }
  }
}

interface ProductFitmentWidgetProps {
  data: {
    id: string
    variants?: Array<{ id: string; title: string; sku: string }>
  }
}

const ProductFitmentWidget = ({ data }: ProductFitmentWidgetProps) => {
  const [fitments, setFitments] = useState<Fitment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string>("")
  const [deleting, setDeleting] = useState<string | null>(null)

  const variants = data?.variants || []

  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0].id)
    }
  }, [variants, selectedVariant])

  const fetchFitments = async () => {
    if (!selectedVariant) return
    
    setLoading(true)
    try {
      const response = await fetch(
        `/admin/automotive/fitments?variant_id=${selectedVariant}`,
        { credentials: "include" }
      )
      
      if (!response.ok) throw new Error("Failed to fetch fitments")
      
      const data = await response.json()
      setFitments(data.fitments || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fitments")
      setFitments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFitments()
  }, [selectedVariant])

  const handleDeleteFitment = async (fitmentId: string) => {
    setDeleting(fitmentId)
    try {
      const response = await fetch(`/admin/automotive/fitments/${fitmentId}`, {
        method: "DELETE",
        credentials: "include",
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete fitment")
      }
      
      // Optimistic update - remove from local state
      setFitments(prev => prev.filter(f => f.id !== fitmentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete fitment")
    } finally {
      setDeleting(null)
    }
  }

  const formatVehicle = (fitment: Fitment) => {
    if (!fitment.vehicle) return "Unknown Vehicle"
    const v = fitment.vehicle
    const make = v.model?.make?.name || ""
    const model = v.model?.name || ""
    const name = v.name || ""
    const years = v.year_from 
      ? `(${v.year_from}-${v.year_to || "present"})`
      : ""
    return `${make} ${model} ${name} ${years}`.trim()
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Vehicle Fitments</Heading>
          <Text className="text-ui-fg-subtle">
            Products compatible with these vehicles
          </Text>
        </div>
        <Badge color={fitments.length > 0 ? "green" : "grey"}>
          {fitments.length} vehicle{fitments.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {variants.length > 1 && (
        <div className="px-6 py-4">
          <label className="text-sm font-medium mb-2 block">Select Variant</label>
          <select 
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title || v.sku || v.id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-4 text-ui-fg-subtle">
            Loading fitments...
          </div>
        ) : error ? (
          <div className="text-center py-4 text-ui-fg-error">
            {error}
          </div>
        ) : fitments.length === 0 ? (
          <div className="text-center py-4 text-ui-fg-subtle">
            No fitments found. Add vehicle compatibility below.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {fitments.map((fitment) => (
              <div 
                key={fitment.id} 
                className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-lg"
              >
                <div>
                  <Text className="font-medium">{formatVehicle(fitment)}</Text>
                  {fitment.position && (
                    <Text className="text-xs text-ui-fg-muted">
                      Position: {fitment.position}
                    </Text>
                  )}
                </div>
                <Button 
                  variant="danger" 
                  size="small"
                  disabled={deleting === fitment.id}
                  onClick={() => handleDeleteFitment(fitment.id)}
                >
                  {deleting === fitment.id ? "..." : "Remove"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-ui-bg-subtle">
        <Text className="text-sm text-ui-fg-muted text-center">
          Use the Fitment Manager to add new vehicle fitments
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductFitmentWidget
