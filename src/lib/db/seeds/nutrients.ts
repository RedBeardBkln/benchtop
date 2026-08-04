// Full FDA Nutrition Facts label nutrient set + extended
// FDA Daily Values: 21 CFR 101.9 (2020 update, effective Jan 1, 2020)
// FDC nutrient numbers: USDA FoodData Central API nutrient IDs
// Source: https://www.accessdata.fda.gov/scripts/interactivenutritionfactslabel/

export interface NutrientSeed {
  name: string
  unit: string
  fdcNutrientNumber: number | null
  dailyValueAmount: string | null  // stored as string for numeric precision
  category: 'macros' | 'vitamins' | 'minerals' | 'other'
  displayOrder: number
}

export const NUTRIENT_SEEDS: NutrientSeed[] = [
  // ---- Macros (display order 1–100) ----
  {
    name: 'Energy',
    unit: 'kcal',
    fdcNutrientNumber: 1008,
    dailyValueAmount: '2000',   // reference calorie intake (not a DV per se, but used for display)
    category: 'macros',
    displayOrder: 1,
  },
  {
    name: 'Protein',
    unit: 'g',
    fdcNutrientNumber: 1003,
    dailyValueAmount: '50',     // FDA DV based on 2000 kcal diet
    category: 'macros',
    displayOrder: 2,
  },
  {
    name: 'Total Fat',
    unit: 'g',
    fdcNutrientNumber: 1004,
    dailyValueAmount: '78',
    category: 'macros',
    displayOrder: 3,
  },
  {
    name: 'Saturated Fat',
    unit: 'g',
    fdcNutrientNumber: 1258,
    dailyValueAmount: '20',
    category: 'macros',
    displayOrder: 4,
  },
  {
    name: 'Trans Fat',
    unit: 'g',
    fdcNutrientNumber: 1257,
    dailyValueAmount: null,     // no DV established
    category: 'macros',
    displayOrder: 5,
  },
  {
    name: 'Polyunsaturated Fat',
    unit: 'g',
    fdcNutrientNumber: 1293,
    dailyValueAmount: null,
    category: 'macros',
    displayOrder: 6,
  },
  {
    name: 'Monounsaturated Fat',
    unit: 'g',
    fdcNutrientNumber: 1292,
    dailyValueAmount: null,
    category: 'macros',
    displayOrder: 7,
  },
  {
    name: 'Cholesterol',
    unit: 'mg',
    fdcNutrientNumber: 1253,
    dailyValueAmount: '300',
    category: 'macros',
    displayOrder: 8,
  },
  {
    name: 'Sodium',
    unit: 'mg',
    fdcNutrientNumber: 1093,
    dailyValueAmount: '2300',
    category: 'macros',
    displayOrder: 9,
  },
  {
    name: 'Total Carbohydrate',
    unit: 'g',
    fdcNutrientNumber: 1005,
    dailyValueAmount: '275',
    category: 'macros',
    displayOrder: 10,
  },
  {
    name: 'Dietary Fiber',
    unit: 'g',
    fdcNutrientNumber: 1079,
    dailyValueAmount: '28',
    category: 'macros',
    displayOrder: 11,
  },
  {
    name: 'Total Sugars',
    unit: 'g',
    fdcNutrientNumber: 2000,  // NLEA sugars
    dailyValueAmount: null,
    category: 'macros',
    displayOrder: 12,
  },
  {
    name: 'Added Sugars',
    unit: 'g',
    fdcNutrientNumber: 1235,
    dailyValueAmount: '50',   // 10% of 2000 kcal per 2020 DV
    category: 'macros',
    displayOrder: 13,
  },
  {
    name: 'Sugar Alcohols',
    unit: 'g',
    fdcNutrientNumber: 1086,
    dailyValueAmount: null,
    category: 'macros',
    displayOrder: 14,
  },

  // ---- Vitamins (display order 101–200) ----
  {
    name: 'Vitamin D',
    unit: 'mcg',
    fdcNutrientNumber: 1114,  // Vitamin D (D2 + D3), USDA sums these
    dailyValueAmount: '20',
    category: 'vitamins',
    displayOrder: 101,
  },
  {
    name: 'Vitamin A',
    unit: 'mcg RAE',
    fdcNutrientNumber: 1106,  // Vitamin A, RAE
    dailyValueAmount: '900',
    category: 'vitamins',
    displayOrder: 102,
  },
  {
    name: 'Vitamin C',
    unit: 'mg',
    fdcNutrientNumber: 1162,
    dailyValueAmount: '90',
    category: 'vitamins',
    displayOrder: 103,
  },
  {
    name: 'Vitamin E',
    unit: 'mg',
    fdcNutrientNumber: 1109,  // alpha-tocopherol
    dailyValueAmount: '15',
    category: 'vitamins',
    displayOrder: 104,
  },
  {
    name: 'Vitamin K',
    unit: 'mcg',
    fdcNutrientNumber: 1185,  // phylloquinone (K1); K2 is separate FDC entry
    dailyValueAmount: '120',
    category: 'vitamins',
    displayOrder: 105,
  },
  {
    name: 'Thiamin (B1)',
    unit: 'mg',
    fdcNutrientNumber: 1165,
    dailyValueAmount: '1.2',
    category: 'vitamins',
    displayOrder: 106,
  },
  {
    name: 'Riboflavin (B2)',
    unit: 'mg',
    fdcNutrientNumber: 1166,
    dailyValueAmount: '1.3',
    category: 'vitamins',
    displayOrder: 107,
  },
  {
    name: 'Niacin (B3)',
    unit: 'mg NE',
    fdcNutrientNumber: 1167,
    dailyValueAmount: '16',
    category: 'vitamins',
    displayOrder: 108,
  },
  {
    name: 'Vitamin B6',
    unit: 'mg',
    fdcNutrientNumber: 1175,
    dailyValueAmount: '1.7',
    category: 'vitamins',
    displayOrder: 109,
  },
  {
    name: 'Folate',
    unit: 'mcg DFE',
    fdcNutrientNumber: 1177,  // Folate, DFE
    dailyValueAmount: '400',
    category: 'vitamins',
    displayOrder: 110,
  },
  {
    name: 'Vitamin B12',
    unit: 'mcg',
    fdcNutrientNumber: 1178,
    dailyValueAmount: '2.4',
    category: 'vitamins',
    displayOrder: 111,
  },
  {
    name: 'Biotin',
    unit: 'mcg',
    fdcNutrientNumber: 1176,
    dailyValueAmount: '30',
    category: 'vitamins',
    displayOrder: 112,
  },
  {
    name: 'Pantothenic Acid (B5)',
    unit: 'mg',
    fdcNutrientNumber: 1170,
    dailyValueAmount: '5',
    category: 'vitamins',
    displayOrder: 113,
  },
  {
    name: 'Choline',
    unit: 'mg',
    fdcNutrientNumber: 1180,
    dailyValueAmount: '550',
    category: 'vitamins',
    displayOrder: 114,
  },

  // ---- Minerals (display order 201–300) ----
  {
    name: 'Calcium',
    unit: 'mg',
    fdcNutrientNumber: 1087,
    dailyValueAmount: '1300',
    category: 'minerals',
    displayOrder: 201,
  },
  {
    name: 'Iron',
    unit: 'mg',
    fdcNutrientNumber: 1089,
    dailyValueAmount: '18',
    category: 'minerals',
    displayOrder: 202,
  },
  {
    name: 'Potassium',
    unit: 'mg',
    fdcNutrientNumber: 1092,
    dailyValueAmount: '4700',
    category: 'minerals',
    displayOrder: 203,
  },
  {
    name: 'Phosphorus',
    unit: 'mg',
    fdcNutrientNumber: 1091,
    dailyValueAmount: '1250',
    category: 'minerals',
    displayOrder: 204,
  },
  {
    name: 'Magnesium',
    unit: 'mg',
    fdcNutrientNumber: 1090,
    dailyValueAmount: '420',
    category: 'minerals',
    displayOrder: 205,
  },
  {
    name: 'Zinc',
    unit: 'mg',
    fdcNutrientNumber: 1095,
    dailyValueAmount: '11',
    category: 'minerals',
    displayOrder: 206,
  },
  {
    name: 'Iodine',
    unit: 'mcg',
    fdcNutrientNumber: 1100,
    dailyValueAmount: '150',
    category: 'minerals',
    displayOrder: 207,
  },
  {
    name: 'Selenium',
    unit: 'mcg',
    fdcNutrientNumber: 1103,
    dailyValueAmount: '55',
    category: 'minerals',
    displayOrder: 208,
  },
  {
    name: 'Copper',
    unit: 'mg',
    fdcNutrientNumber: 1098,
    dailyValueAmount: '0.9',
    category: 'minerals',
    displayOrder: 209,
  },
  {
    name: 'Manganese',
    unit: 'mg',
    fdcNutrientNumber: 1101,
    dailyValueAmount: '2.3',
    category: 'minerals',
    displayOrder: 210,
  },
  {
    name: 'Chromium',
    unit: 'mcg',
    fdcNutrientNumber: 1096,
    dailyValueAmount: '35',
    category: 'minerals',
    displayOrder: 211,
  },
  {
    name: 'Molybdenum',
    unit: 'mcg',
    fdcNutrientNumber: 1102,
    dailyValueAmount: '45',
    category: 'minerals',
    displayOrder: 212,
  },
  {
    name: 'Chloride',
    unit: 'mg',
    fdcNutrientNumber: null,  // not a standard USDA FDC nutrient — verify before use
    dailyValueAmount: '2300',
    category: 'minerals',
    displayOrder: 213,
  },
]
