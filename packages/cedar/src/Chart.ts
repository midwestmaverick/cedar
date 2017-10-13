import { cedarAmCharts, deepMerge } from '@esri/cedar-amcharts'
// import { append, flatten, join } from './flatten/flatten'
import flattenFeatures from './flatten/flatten'
import { getData } from './query/query'
import { createFeatureServiceRequest } from './query/url'

function clone(json) {
  return JSON.parse(JSON.stringify(json))
}

// TODO: move this to flatten, or?
function getChartData(datasets: IDataset[], series: ISeries[], datasetsData?: {}) {
  const featureSets = []
  const joinKeys = []
  // TODO: remove transformFucntions here and from flattenFeatures
  const transformFunctions = []

  // get array of featureSets from datasets data or datasetsData
  datasets.forEach((dataset, i) => {
    // TODO: make name required on datasets, or required if > 1 dataset?
    const name = dataset.name || `dataset${i}`
    // if dataset doesn't have inline data use data that was passed in
    const featureSet = dataset.data || datasetsData[name]
    if (featureSet) {
      featureSets.push(featureSet)
    }
    // TOOD: later support append, but for now, always do join
    // assuming a 1:1 relationship between datasets and series
    if (!dataset.append) {
      joinKeys.push(series[i].category.field)
    }
  })

  // flatten data from all datasets into a single table
  // if there's only one dataset, just flatten the features
  // if more than one, need to join or append the feature sets
  // return (featureSets.length === 1) ? flatten(featureSets[0]) : (joinKeys.length > 0) ? join(featureSets, joinKeys) : append(featureSets)
  return flattenFeatures(featureSets, joinKeys)
}

// TODO: where should these interfaces live?
export interface IDataset {
  name: string,
  url?: string,
  data?: any[],
  query: {},
  append?: boolean
}

export interface IField {
  field: string,
  label?: string
}

export interface ISeries {
  source: string,
  category?: IField,
  value?: IField
}

export interface IDefinition {
  datasets: IDataset[],
  series: ISeries[],
  type?: string
  specification?: {}
  overrides?: {}
}

export default class Chart {
  private _container: string
  private _definition: IDefinition
  private _data: any[]

  constructor(container, definition?) {
    if (!container) {
      throw new Error('A container is required')
    }
    this._container = container

    if (definition) {
      // set the definition
      this.setDefinition(clone(definition))
    }
  }

  // Setters and getters
  public getDefinition() {
    return this._definition
  }
  public setDefinition(definition) {
    this._definition = definition
    return this
  }

  public getDatasets() {
    return this._definition ? this._definition.datasets : undefined
  }
  public setDatasets(datasets) {
    if (this._definition) {
      this._definition.datasets = datasets
      return this
    } else {
      return this.setDefinition({
        datasets
      })
    }
  }

  public getSeries() {
    return this._definition ? this._definition.series : undefined
  }
  public setSeries(series) {
    if (this._definition) {
      this._definition.series = series
      return this
    } else {
      return this.setDefinition({
        series
      })
    }
  }

  public getType() {
    return this._definition ? this._definition.type : undefined
  }
  public setType(type) {
    if (this._definition) {
      this._definition.type = type
      return this
    } else {
      return this.setDefinition({
        type
      })
    }
  }

  public getSpecification() {
    return this._definition ? this._definition.specification : undefined
  }
  public setSpecification(specification) {
    if (this._definition) {
      this._definition.specification = specification
      return this
    } else {
      return this.setDefinition({
        specification
      })
    }
  }

  public getOverrides() {
    return this._definition ? this._definition.overrides : undefined
  }
  public setOverrides(overrides) {
    if (this._definition) {
      this._definition.overrides = overrides
      return this
    } else {
      return this.setDefinition({
        overrides
      })
    }
  }

  // chart data
  public getData() {
    return this._data
  }

  // query non-inline datasets
  public queryData() {
    const names = []
    const requests = []
    const responseHash = {}
    const datasets = this.getDatasets()

    if (datasets) {
      datasets.forEach((dataset, i) => {
        // only query datasets that don't have inline data
        if (dataset.url) {
          // TODO: make name required on datasets, or required if > 1 dataset?
          names.push(dataset.name || `dataset${i}`)
          requests.push(getData(createFeatureServiceRequest(dataset)))
        }
      })
    }
    return Promise.all(requests)
    .then((responses) => {
      responses.forEach((response, i) => {
        responseHash[names[i]] = responses[i]
      })
      return Promise.resolve(responseHash)
    }, (err) => {
      return Promise.reject(err)
    })
  }

  // update chart from inline data and query responses
  public updateData(datasetsData) {
    const datasets = this.getDatasets()
    this._data = datasets ? getChartData(datasets, this.getSeries(), datasetsData) : []
    return this
  }

  // re-draw the chart based on the current state
  public render() {
    cedarAmCharts(this._container, this.getDefinition(), this.getData())
    return this
  }

  // rollup the query, update, and render functions
  // useful for showing the chart for the first time
  public show() {
    return this.queryData()
    .then((response) => {
      return this.updateData(response).render()
    })
  }
}
