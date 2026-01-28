import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { AUTOMOTIVE_MODULE } from "../index"

moduleIntegrationTestRunner({
  moduleName: AUTOMOTIVE_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("Automotive Module Service", () => {
      it("should export the service", () => {
        expect(service).toBeDefined()
      })

      it("should have CRUD methods for Manufacturer", () => {
        expect(service.createVehicleManufacturers).toBeDefined()
        expect(service.retrieveVehicleManufacturer).toBeDefined()
      })
      
      it("should have CRUD methods for Fitment", () => {
          expect(service.createFitments).toBeDefined()
      })
    })
  },
})
