import { model } from "@medusajs/utils"

// 1. Test Model
export const TestModel = model.define("test_model", {
  id: model.id().primaryKey(),
  name: model.text(),
})
