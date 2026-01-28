# Changelog

## Review & Testing Session

## Fixes Applied

### Backend API
1. **Fixed vehicle filter query** - Changed from `term` to `terms` query for array field `vehicle_type_ids`
2. **Improved price calculation** - SKU details now only use in-stock offers for best price
3. **Fixed lead time calculation** - Now uses minimum lead time from available offers
4. **Enhanced error handling** - Better validation for filter parameters

### Data Generation
1. **Fixed lead time indexing** - OpenSearch now stores actual lead times instead of dummy value
2. **Improved SQL query** - Added lead time calculation to indexing query

### Storefront
1. **Fixed vehicle selector display** - Better formatting for vehicle type names
2. **Improved error handling** - Better fallbacks for missing data

## Code Quality Improvements

- Added comprehensive error handling
- Improved input validation
- Better code documentation
- Consistent error messages

## Documentation Added

- `TESTING.md` - Comprehensive testing guide
- `REVIEW.md` - Code review summary
- `CHANGELOG.md` - This file

## Known Limitations

- Cart uses localStorage (not persistent)
- Checkout is placeholder (doesn't process orders)
- Pagination UI not implemented (backend supports it)
- Advanced filter UI is placeholder
- Product images are placeholders

## Next Steps

1. Integrate Medusa cart API
2. Add pagination UI
3. Implement advanced filters UI
4. Add product images
5. Add automated tests
