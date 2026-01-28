/**
 * Vehicle Management Page
 * 
 * Custom admin route for managing vehicle hierarchy (Makes → Models → Types).
 * Accessible at /admin/automotive/vehicles
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button, Table, Input, Tabs } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { TruckFast } from "@medusajs/icons"

interface Make {
  id: string
  name: string
  slug: string
  country: string | null
  created_at: string
}

interface Model {
  id: string
  name: string
  slug: string
  make_id: string
  make?: Make
  created_at: string
}

interface VehicleType {
  id: string
  name: string
  slug: string
  model_id: string
  year_from: number
  year_to: number | null
  fuel_type: string | null
  engine: string | null
  body_type: string | null
  model?: Model
  created_at: string
}

const VehicleManagementPage = () => {
  const [activeTab, setActiveTab] = useState("makes")
  const [makes, setMakes] = useState<Make[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [types, setTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedMake, setSelectedMake] = useState<string>("")

  // Fetch makes
  useEffect(() => {
    const fetchMakes = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.append("search", search)
        params.append("limit", "100")
        
        const res = await fetch(`/admin/automotive/makes?${params}`, { credentials: "include" })
        const data = await res.json()
        setMakes(data.makes || [])
      } catch (err) {
        console.error("Failed to fetch makes:", err)
      } finally {
        setLoading(false)
      }
    }
    
    if (activeTab === "makes") fetchMakes()
  }, [activeTab, search])

  // Fetch models
  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.append("search", search)
        if (selectedMake) params.append("make_id", selectedMake)
        params.append("limit", "100")
        
        const res = await fetch(`/admin/automotive/models?${params}`, { credentials: "include" })
        const data = await res.json()
        setModels(data.models || [])
      } catch (err) {
        console.error("Failed to fetch models:", err)
      } finally {
        setLoading(false)
      }
    }
    
    if (activeTab === "models") fetchModels()
  }, [activeTab, search, selectedMake])

  // Fetch types
  useEffect(() => {
    const fetchTypes = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.append("search", search)
        params.append("limit", "100")
        
        const res = await fetch(`/admin/automotive/types?${params}`, { credentials: "include" })
        const data = await res.json()
        setTypes(data.types || [])
      } catch (err) {
        console.error("Failed to fetch types:", err)
      } finally {
        setLoading(false)
      }
    }
    
    if (activeTab === "types") fetchTypes()
  }, [activeTab, search])

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <TruckFast className="w-8 h-8 text-ui-fg-subtle" />
          <div>
            <Heading level="h1">Vehicle Management</Heading>
            <Text className="text-ui-fg-subtle">
              Manage vehicle makes, models, and types
            </Text>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge color="blue">{makes.length} Makes</Badge>
          <Badge color="green">{models.length} Models</Badge>
          <Badge color="purple">{types.length} Types</Badge>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Tabs */}
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="makes">Makes ({makes.length})</Tabs.Trigger>
            <Tabs.Trigger value="models">Models ({models.length})</Tabs.Trigger>
            <Tabs.Trigger value="types">Types ({types.length})</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="makes" className="pt-4">
            {loading ? (
              <Text className="text-ui-fg-subtle">Loading...</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Slug</Table.HeaderCell>
                    <Table.HeaderCell>Country</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {makes.map((make) => (
                    <Table.Row key={make.id}>
                      <Table.Cell className="font-medium">{make.name}</Table.Cell>
                      <Table.Cell className="text-ui-fg-muted">{make.slug}</Table.Cell>
                      <Table.Cell>{make.country || "-"}</Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="small">Edit</Button>
                          <Button variant="danger" size="small">Delete</Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Tabs.Content>

          <Tabs.Content value="models" className="pt-4">
            <div className="mb-4">
              <select 
                value={selectedMake}
                onChange={(e) => setSelectedMake(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All Makes</option>
                {makes.map((make) => (
                  <option key={make.id} value={make.id}>{make.name}</option>
                ))}
              </select>
            </div>
            
            {loading ? (
              <Text className="text-ui-fg-subtle">Loading...</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Make</Table.HeaderCell>
                    <Table.HeaderCell>Slug</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {models.map((model) => (
                    <Table.Row key={model.id}>
                      <Table.Cell className="font-medium">{model.name}</Table.Cell>
                      <Table.Cell>{model.make?.name || "-"}</Table.Cell>
                      <Table.Cell className="text-ui-fg-muted">{model.slug}</Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="small">Edit</Button>
                          <Button variant="danger" size="small">Delete</Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Tabs.Content>

          <Tabs.Content value="types" className="pt-4">
            {loading ? (
              <Text className="text-ui-fg-subtle">Loading...</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Vehicle</Table.HeaderCell>
                    <Table.HeaderCell>Years</Table.HeaderCell>
                    <Table.HeaderCell>Fuel</Table.HeaderCell>
                    <Table.HeaderCell>Engine</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {types.map((type) => (
                    <Table.Row key={type.id}>
                      <Table.Cell className="font-medium">
                        {type.model?.make?.name} {type.model?.name} {type.name}
                      </Table.Cell>
                      <Table.Cell>
                        {type.year_from} - {type.year_to || "present"}
                      </Table.Cell>
                      <Table.Cell>{type.fuel_type || "-"}</Table.Cell>
                      <Table.Cell>{type.engine || "-"}</Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="small">Edit</Button>
                          <Button variant="danger" size="small">Delete</Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Tabs.Content>
        </Tabs>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Vehicles",
  icon: TruckFast,
})

export default VehicleManagementPage
