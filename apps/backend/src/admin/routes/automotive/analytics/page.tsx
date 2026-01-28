/**
 * Analytics Dashboard Page
 * 
 * Custom admin route showing automotive analytics and inventory stats.
 * Accessible at /admin/automotive/analytics
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { ChartBar } from "@medusajs/icons"

interface AnalyticsData {
  automotive: {
    makes: number
    models: number
    types: number
    fitments: number
    garage_entries: number
    categories: number
    attributes: number
  }
  products: {
    total: number
    variants: number
    with_inventory: number
  }
  inventory: {
    total_levels: number
    total_stock: number
    total_reserved: number
    out_of_stock: number
    low_stock: number
  }
  activity: {
    fitments_last_7_days: number
  }
  top_makes: Array<{ name: string; id: string; model_count: number }>
  generated_at: string
}

const StatCard = ({ label, value, color = "blue" }: { label: string; value: number | string; color?: string }) => (
  <div className="bg-ui-bg-subtle rounded-xl p-4 border border-ui-border-base">
    <Text className="text-ui-fg-muted text-sm">{label}</Text>
    <Text className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</Text>
  </div>
)

const AnalyticsDashboardPage = () => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const res = await fetch("/admin/automotive/analytics", { credentials: "include" })
        if (!res.ok) throw new Error("Failed to fetch analytics")
        const data = await res.json()
        setData(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Loading analytics...</Text>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-error">{error}</Text>
      </Container>
    )
  }

  if (!data) return null

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <ChartBar className="w-8 h-8 text-ui-fg-subtle" />
          <div>
            <Heading level="h1">Analytics Dashboard</Heading>
            <Text className="text-ui-fg-subtle">
              Automotive system overview and statistics
            </Text>
          </div>
        </div>
        <Text className="text-xs text-ui-fg-muted">
          Updated: {new Date(data.generated_at).toLocaleString()}
        </Text>
      </div>

      {/* Automotive Stats */}
      <div className="px-6 py-4">
        <Heading level="h2" className="mb-4">Automotive Data</Heading>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard label="Makes" value={data.automotive.makes} />
          <StatCard label="Models" value={data.automotive.models} />
          <StatCard label="Types" value={data.automotive.types} />
          <StatCard label="Fitments" value={data.automotive.fitments} />
          <StatCard label="Garage Entries" value={data.automotive.garage_entries} />
          <StatCard label="Categories" value={data.automotive.categories} />
          <StatCard label="Attributes" value={data.automotive.attributes} />
        </div>
      </div>

      {/* Product Stats */}
      <div className="px-6 py-4">
        <Heading level="h2" className="mb-4">Products & Inventory</Heading>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total Products" value={data.products.total} />
          <StatCard label="Total Variants" value={data.products.variants} />
          <StatCard label="With Inventory" value={data.products.with_inventory} />
          <StatCard label="Total Stock" value={data.inventory.total_stock} />
          <StatCard label="Reserved" value={data.inventory.total_reserved} />
        </div>
      </div>

      {/* Inventory Health */}
      <div className="px-6 py-4">
        <Heading level="h2" className="mb-4">Inventory Health</Heading>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-ui-bg-subtle rounded-xl p-4 border border-ui-border-base">
            <Text className="text-ui-fg-muted text-sm">Inventory Levels</Text>
            <Text className="text-2xl font-bold mt-1">{data.inventory.total_levels.toLocaleString()}</Text>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <Text className="text-red-600 text-sm">Out of Stock</Text>
            <Text className="text-2xl font-bold mt-1 text-red-700">{data.inventory.out_of_stock.toLocaleString()}</Text>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <Text className="text-yellow-600 text-sm">Low Stock (≤5)</Text>
            <Text className="text-2xl font-bold mt-1 text-yellow-700">{data.inventory.low_stock.toLocaleString()}</Text>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <Text className="text-green-600 text-sm">Fitments (7 days)</Text>
            <Text className="text-2xl font-bold mt-1 text-green-700">{data.activity.fitments_last_7_days.toLocaleString()}</Text>
          </div>
        </div>
      </div>

      {/* Top Makes */}
      <div className="px-6 py-4">
        <Heading level="h2" className="mb-4">Top Vehicle Makes by Model Count</Heading>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {data.top_makes.slice(0, 10).map((make, index) => (
            <div key={make.id} className="bg-ui-bg-subtle rounded-lg p-3 border border-ui-border-base flex items-center gap-3">
              <Badge color={index < 3 ? "green" : "grey"}>{index + 1}</Badge>
              <div>
                <Text className="font-medium">{make.name}</Text>
                <Text className="text-xs text-ui-fg-muted">{make.model_count} models</Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsDashboardPage
