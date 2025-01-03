import { AdditionalService } from '@models/additionalService.model'
import { AdditionalServiceCostPricing } from '@models/additionalServiceCostPricing.model'
import { ShipmentAdditionalServicePrice } from '@models/shipmentAdditionalServicePrice.model'
import { find, get } from 'lodash'

export function getAdditionalServicePrice(
  serviceName: string,
  existingServices: ShipmentAdditionalServicePrice[] = [],
  services: AdditionalServiceCostPricing[] = [],
) {
  const additionalExistingServiceDroppoint = find(existingServices, (service: ShipmentAdditionalServicePrice) => {
    const coreService = get(service, 'reference.additionalService', undefined) as AdditionalService
    return coreService?.name === serviceName
  })

  if (additionalExistingServiceDroppoint) {
    const service = additionalExistingServiceDroppoint as ShipmentAdditionalServicePrice
    return {
      price: service.price || 0,
      cost: service.cost || 0,
    }
  } else {
    const additionalServiceDroppoint = find(services, (service: AdditionalServiceCostPricing) => {
      const coreService = service.additionalService as AdditionalService
      return coreService.name === serviceName
    })

    if (additionalServiceDroppoint) {
      return {
        price: additionalServiceDroppoint.price || 0,
        cost: additionalServiceDroppoint.cost || 0,
      }
    }
    return {
      price: 0,
      cost: 0,
    }
  }
}
