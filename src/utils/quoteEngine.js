import {
  MOCK_PRICING,
  WALL_BRACKET_MAP,
  WALL_STOPPER_MAP,
} from "../constants/pricing";

const STANDARD_SIZES = {
  slotted: {
    length: [{v: "2", in: 24}, {v: "3", in: 36}, {v: "4", in: 48}],
    breadth: [{v: "12", in: 12}, {v: "15", in: 15}, {v: "18", in: 18}, {v: "24", in: 24}],
    height: [{v: "3", in: 36}, {v: "4", in: 48}, {v: "5", in: 60}, {v: "6", in: 72}, {v: "6.5", in: 78}, {v: "7", in: 84}, {v: "8", in: 96}, {v: "10", in: 120}]
  },
  wall: {
    length: [{v: "35.5", in: 35.5}, {v: "47.5", in: 47.5}],
    breadth: [{v: "6.25", in: 6.25}, {v: "9.25", in: 9.25}, {v: "12.25", in: 12.25}, {v: "14.25", in: 14.25}, {v: "16.25", in: 16.25}],
    height: [{v: "4", in: 48}, {v: "6", in: 72}]
  },
  pigeon: {
    length: [{v: "2", in: 24}, {v: "3", in: 36}, {v: "4", in: 48}],
    breadth: [{v: "12", in: 12}, {v: "15", in: 15}, {v: "18", in: 18}, {v: "24", in: 24}],
    height: [{v: "3", in: 36}, {v: "4", in: 48}, {v: "5", in: 60}, {v: "6", in: 72}, {v: "6.5", in: 78}, {v: "7", in: 84}, {v: "8", in: 96}, {v: "10", in: 120}]
  },
  gondola: {
    length: [{v: "3", in: 36}, {v: "4", in: 48}],
    breadth: [{v: "6.25", in: 6.25}, {v: "9.25", in: 9.25}, {v: "12.25", in: 12.25}, {v: "14.25", in: 14.25}, {v: "16.25", in: 16.25}],
    height: [{v: "4", in: 48}, {v: "5", in: 60}, {v: "6", in: 72}, {v: "7", in: 84}]
  }
};

export const getPricingDim = (type, dimName, valueStr, customVal) => {
  if (valueStr !== "custom") return valueStr;
  const inches = parseFloat(customVal);
  const arr = STANDARD_SIZES[type]?.[dimName];
  if (!arr) return valueStr;
  for (const size of arr) {
    if (inches <= size.in) return size.v;
  }
  return arr[arr.length - 1].v;
};


export const calculateQuote = ({
  cart,
  overrides,
  slottedFittingRate,
  wallFittingRate,
  pigeonFittingCharge,
  gondolaFittingCharge,
  rickshawRent,
  isFittingOpted,
  applyMarkup,
}) => {
  if (cart.length === 0) return null;

  const m = applyMarkup ? 1.09 : 1;
  // Slotted Aggregators
  let sBolts = 0,
    sCorners = 0,
    sBushes = 0;
  const sAnglesGrp = {};
  const sPlatesGrp = {};
  let totalSlottedPlates = 0;

  // Pigeon Aggregators
  let pBolts = 0,
    pCorners = 0,
    pBushes = 0;
  const pAnglesGrp = {};
  const pPlatesGrp = {};
  const pCladdingGrp = {};
  const pDividersGrp = {};
  const pStoppersGrp = {};

  // Wall Aggregators
  let wScrews = 0;
  let totalWallChannels = 0;
  const wChannelsGrp = {};
  const wPlatesGrp = {};
  const wBracketsGrp = {};
  const wStoppersGrp = {};

  // Gondola Aggregators
  let gBuffers = 0;
  const gStandsGrp = {};
  const gPlatesGrp = {};
  const gBracketsGrp = {};
  const gStoppersGrp = {};
  const gCladdingGrp = {};
  const gBottomsGrp = {};

  const enrichedCart = cart.map((item) => {
    const { type, bays, shelvesPerRack, qty, dimensions: d } = item;

    // --- CUSTOM PARTS LOGIC ---
    if (item.isCustomPart) {
      if (type === "slotted") {
        if (item.partCategory === "plates") {
          if (!sPlatesGrp[item.partLabel])
            sPlatesGrp[item.partLabel] = { qty: 0, price: item.partPrice };
          sPlatesGrp[item.partLabel].qty += item.qty;
          totalSlottedPlates += item.qty;
        } else if (item.partCategory === "angles") {
          if (!sAnglesGrp[item.partLabel])
            sAnglesGrp[item.partLabel] = { qty: 0, price: item.partPrice };
          sAnglesGrp[item.partLabel].qty += item.qty;
        } else if (item.partCategory === "bolts") sBolts += item.qty;
        else if (item.partCategory === "corners") sCorners += item.qty;
        else if (item.partCategory === "bushes") sBushes += item.qty;
      } else {
        if (item.partCategory === "plates") {
          if (!wPlatesGrp[item.partLabel])
            wPlatesGrp[item.partLabel] = { qty: 0, price: item.partPrice };
          wPlatesGrp[item.partLabel].qty += item.qty;
        } else if (item.partCategory === "channels") {
          if (!wChannelsGrp[item.partLabel])
            wChannelsGrp[item.partLabel] = { qty: 0, price: item.partPrice };
          wChannelsGrp[item.partLabel].qty += item.qty;
          totalWallChannels += item.qty;
        } else if (item.partCategory === "brackets") {
          if (!wBracketsGrp[item.partLabel])
            wBracketsGrp[item.partLabel] = { qty: 0, price: item.partPrice };
          wBracketsGrp[item.partLabel].qty += item.qty;
        } else if (item.partCategory === "stoppers") {
          if (!wStoppersGrp[item.partLabel])
            wStoppersGrp[item.partLabel] = { qty: 0, price: item.partPrice };
          wStoppersGrp[item.partLabel].qty += item.qty;
        } else if (item.partCategory === "screws") wScrews += item.qty;
      }
      return item;
    }

    const channelsOrAnglesCount = bays.length + 1;
    const totalPlatesInRow = shelvesPerRack * qty;
    let itemTotal = 0;

    // === SLOTTED ANGLE LOGIC ===
    if (type === "slotted") {
      const pricingHeight = getPricingDim(type, "height", d.height, d.customHeight);
      const pricingBreadth = getPricingDim(type, "breadth", d.breadth, d.customBreadth);
      const displayHeight = d.height === "custom" ? `${d.customHeight}"` : `${d.height}ft`;
      const displayBreadth = d.breadth === "custom" ? `${d.customBreadth}"` : `${d.breadth}"`;

      const angles = channelsOrAnglesCount * 2 * qty;
      const bolts = angles * (shelvesPerRack >= 2 ? 2 * shelvesPerRack + 4 : 8);
      sBolts += bolts;
      sCorners += angles * 2;
      sBushes += angles;

      const aPrice =
        (MOCK_PRICING.slotted.angles[pricingHeight]?.[d.angleGauge] || 0) +
        (d.angleColor === "custom"
          ? MOCK_PRICING.slotted.colorSurcharge.angles[pricingHeight] || 0
          : 0);
      const aLabel = `${displayHeight} Angle (${d.angleGauge}G)${d.angleColor === "custom" ? ` - Custom Color` : ""}`;
      if (!sAnglesGrp[aLabel]) sAnglesGrp[aLabel] = { qty: 0, price: aPrice };
      sAnglesGrp[aLabel].qty += angles;

      let itemPlatesCost = 0;
      bays.forEach((bayItem) => {
        const isCustomBay = typeof bayItem === "object" && bayItem.isCustom;
        const rawBayVal = isCustomBay ? bayItem.val : bayItem;
        const pricingLength = isCustomBay 
          ? getPricingDim(type, "length", "custom", rawBayVal) 
          : rawBayVal;
        const displayLength = isCustomBay ? `${rawBayVal}"` : `${rawBayVal}'`;

        const pPrice =
          (MOCK_PRICING.slotted.plates[`${pricingLength}-${pricingBreadth}`]?.[
            d.plateGauge
          ] || 0) +
          (d.plateColor === "custom"
            ? MOCK_PRICING.slotted.colorSurcharge.plates[
                `${pricingLength}-${pricingBreadth}`
              ] || 0
            : 0);
        const pLabel = `${displayLength}x${displayBreadth} Plate (${d.plateGauge}G)${d.plateColor === "custom" ? ` - Custom Color` : ""}`;
        if (!sPlatesGrp[pLabel]) sPlatesGrp[pLabel] = { qty: 0, price: pPrice };
        sPlatesGrp[pLabel].qty += totalPlatesInRow;
        itemPlatesCost += totalPlatesInRow * pPrice;
        totalSlottedPlates += totalPlatesInRow;
      });

      itemTotal =
        angles * aPrice +
        itemPlatesCost +
        bolts * MOCK_PRICING.slotted.hardware.bolt +
        angles * 2 * MOCK_PRICING.slotted.hardware.corner +
        angles * MOCK_PRICING.slotted.hardware.bush;
    }

    // === PIGEON HOLE LOGIC ===
    else if (type === "pigeon") {
      const pricingHeight = getPricingDim(type, "height", d.height, d.customHeight);
      const pricingBreadth = getPricingDim(type, "breadth", d.breadth, d.customBreadth);
      const displayHeight = d.height === "custom" ? `${d.customHeight}"` : `${d.height}ft`;
      const displayBreadth = d.breadth === "custom" ? `${d.customBreadth}"` : `${d.breadth}"`;

      const isCustomBay = typeof bays[0] === "object" && bays[0].isCustom;
      const rawBayVal = isCustomBay ? bays[0].val : bays[0];
      const pricingLength = isCustomBay 
        ? getPricingDim(type, "length", "custom", rawBayVal) 
        : rawBayVal;
      const displayLength = isCustomBay ? `${rawBayVal}"` : `${rawBayVal}'`;
      // For arithmetic, we need length in feet and breadth in inches. 
      // If it's custom, convert inches to feet if necessary, or just use the inches value appropriately.
      const numLengthFt = isCustomBay ? parseFloat(rawBayVal) / 12 : parseFloat(rawBayVal);
      const numBreadthInches = d.breadth === "custom" ? parseFloat(d.customBreadth) : parseFloat(d.breadth);
      const numHeightFt = d.height === "custom" ? parseFloat(d.customHeight) / 12 : parseFloat(d.height);

      const angles = 4 * qty;
      const spacesBetweenPlates = Math.max(1, shelvesPerRack - 1);
      let totalIndividualDividers = 0;

      // Determine columns for each space gap
      const spaceCols = [];
      for (let s = 0; s < spacesBetweenPlates; s++) {
        const cols = (d.useCustomColumns && Array.isArray(d.customColumns) && d.customColumns[s] !== undefined)
          ? d.customColumns[s]
          : d.columns;
        const finalCols = Math.max(1, cols);
        spaceCols.push(finalCols);
        totalIndividualDividers += finalCols - 1;
      }

      // Calculate total divider bolts using fractional positions union at each plate level
      let totalDividerBolts = 0;
      for (let p = 0; p < shelvesPerRack; p++) {
        const posBelow = new Set();
        if (p > 0) {
          const colsBelow = spaceCols[p - 1];
          for (let i = 1; i < colsBelow; i++) {
            posBelow.add((i / colsBelow).toFixed(6));
          }
        }

        const posAbove = new Set();
        if (p < spacesBetweenPlates) {
          const colsAbove = spaceCols[p];
          for (let i = 1; i < colsAbove; i++) {
            posAbove.add((i / colsAbove).toFixed(6));
          }
        }

        const union = new Set([...posBelow, ...posAbove]);
        totalDividerBolts += union.size * 2;
      }

      const baseBolts =
        angles * (shelvesPerRack >= 2 ? 2 * shelvesPerRack + 4 : 8) - 8 * qty;
      const extraBolts = totalDividerBolts * qty;
      const bolts = baseBolts + extraBolts;

      const corners = 4 * qty;
      const bushes = 4 * qty;

      pBolts += bolts;
      pCorners += corners;
      pBushes += bushes;

      const aPrice = MOCK_PRICING.slotted.angles[pricingHeight]?.[d.angleGauge] || 0;
      const aLabel = `${displayHeight} Angle (${d.angleGauge}G)`;
      if (!pAnglesGrp[aLabel]) pAnglesGrp[aLabel] = { qty: 0, price: aPrice };
      pAnglesGrp[aLabel].qty += angles;

      const pPrice =
        MOCK_PRICING.slotted.plates[`${pricingLength}-${pricingBreadth}`]?.[
          d.plateGauge
        ] || 0;
      const pLabel = `${displayLength}x${displayBreadth} Plate (${d.plateGauge}G)`;
      if (!pPlatesGrp[pLabel]) pPlatesGrp[pLabel] = { qty: 0, price: pPrice };
      pPlatesGrp[pLabel].qty += totalPlatesInRow;

      // Cladding Sheets
      const backAreaSqFt = numLengthFt * numHeightFt;
      const sideAreaSqFt = (numBreadthInches / 12) * numHeightFt;
      const claddingRate = MOCK_PRICING.pigeon.rates.claddingPerSqFt;

      const backPrice = Math.round(backAreaSqFt * claddingRate);
      const backLabel = `${displayLength} W x ${displayHeight} H Back Cladding`;
      if (!pCladdingGrp[backLabel])
        pCladdingGrp[backLabel] = { qty: 0, price: backPrice };
      pCladdingGrp[backLabel].qty += 1 * qty;

      const sidePrice = Math.round(sideAreaSqFt * claddingRate);
      const sideLabel = `${displayBreadth} D x ${displayHeight} H Side Cladding`;
      if (!pCladdingGrp[sideLabel])
        pCladdingGrp[sideLabel] = { qty: 0, price: sidePrice };
      pCladdingGrp[sideLabel].qty += 2 * qty;
      const claddingCost = backPrice * 1 * qty + sidePrice * 2 * qty;

      // Vertical Dividers
      let dividerCost = 0;
      if (totalIndividualDividers > 0) {
        const dividerHeightFt =
          (numHeightFt - 0.25) / spacesBetweenPlates;
        const divAreaSqFt = (numBreadthInches / 12) * dividerHeightFt;
        const dividerRate = MOCK_PRICING.pigeon.rates.dividerPerSqFt;

        const divPrice = Math.round(divAreaSqFt * dividerRate);
        const divLabel = `${displayBreadth} x ${(dividerHeightFt * 12).toFixed(1)}" Divider`;
        if (!pDividersGrp[divLabel])
          pDividersGrp[divLabel] = { qty: 0, price: divPrice };
        pDividersGrp[divLabel].qty += totalIndividualDividers * qty;
        dividerCost = totalIndividualDividers * divPrice * qty;
      }

      // Stoppers
      let stopperCost = 0;
      if (d.hasStopper && shelvesPerRack > 1) {
        const stopperRows = shelvesPerRack - 1;
        const stopperAreaSqFt = (3 / 12) * numLengthFt;
        const stopperRate = MOCK_PRICING.pigeon.rates.stopperPerSqFt;

        const stopperPrice = Math.round(stopperAreaSqFt * stopperRate);
        const stLabel = `${displayLength} W x 3" Stopper`;
        if (!pStoppersGrp[stLabel])
          pStoppersGrp[stLabel] = { qty: 0, price: stopperPrice };
        pStoppersGrp[stLabel].qty += stopperRows * qty;
        stopperCost = stopperRows * stopperPrice * qty;
      }

      itemTotal =
        angles * aPrice +
        totalPlatesInRow * pPrice +
        claddingCost +
        dividerCost +
        stopperCost +
        bolts * MOCK_PRICING.slotted.hardware.bolt +
        corners * MOCK_PRICING.slotted.hardware.corner +
        bushes * MOCK_PRICING.slotted.hardware.bush;
    }

    // === WALL MOUNTED LOGIC ===
    else if (type === "wall") {
      const pricingHeight = getPricingDim(type, "height", d.height, d.customHeight);
      const pricingBreadth = getPricingDim(type, "breadth", d.breadth, d.customBreadth);
      const displayHeight = d.height === "custom" ? `${d.customHeight}"` : `${d.height}ft`;
      const displayBreadth = d.breadth === "custom" ? `${d.customBreadth}"` : `${d.breadth}"`;

      const channels = channelsOrAnglesCount * qty;
      totalWallChannels += channels;

      const cPrice = MOCK_PRICING.wall.channels[pricingHeight] || 0;
      const cLabel = `${displayHeight} Channel`;
      if (!wChannelsGrp[cLabel])
        wChannelsGrp[cLabel] = { qty: 0, price: cPrice };
      wChannelsGrp[cLabel].qty += channels;

      const screws = channels * (pricingHeight === "4" ? 5 : 7);
      wScrews += screws;

      let itemPlatesCost = 0;
      let itemStoppersCost = 0;
      let itemBracketsCost = 0;

      for (let s = 0; s < shelvesPerRack; s++) {
        // Resolve breadth for this layer
        const layerIdx = shelvesPerRack - 1 - s;
        const layerBreadthRaw = (d.useCustomBreadths && Array.isArray(d.customBreadths) && d.customBreadths[layerIdx] !== undefined)
          ? d.customBreadths[layerIdx]
          : d.breadth;
        const layerCustomVal = (d.useCustomBreadths && Array.isArray(d.customBreadthsVals) && d.customBreadthsVals[layerIdx] !== undefined)
          ? d.customBreadthsVals[layerIdx]
          : (d.customBreadth || "10");
        const layerPricingBreadth = getPricingDim(type, "breadth", layerBreadthRaw, layerCustomVal);
        const layerDisplayBreadth = layerBreadthRaw === "custom" ? `${layerCustomVal}"` : `${layerBreadthRaw}"`;

        // Brackets for this layer
        const layerBrackets = (channelsOrAnglesCount + (d.hasStopper ? Math.max(0, bays.length - 1) : 0)) * qty;
        const bracketSize = WALL_BRACKET_MAP[layerPricingBreadth];
        const actualBreadth = parseFloat(layerBreadthRaw === "custom" ? layerCustomVal : layerBreadthRaw);
        const displayBracket = actualBreadth + 0.75;
        const bPrice = MOCK_PRICING.wall.brackets[bracketSize] || 0;
        const bLabel = `${displayBracket}" Bracket`;
        if (!wBracketsGrp[bLabel])
          wBracketsGrp[bLabel] = { qty: 0, price: bPrice };
        wBracketsGrp[bLabel].qty += layerBrackets;
        itemBracketsCost += layerBrackets * bPrice;

        // Plates and Stoppers for this layer across all bays
        bays.forEach((bayItem) => {
          const isCustomBay = typeof bayItem === "object" && bayItem.isCustom;
          const rawBayVal = isCustomBay ? bayItem.val : bayItem;
          const pricingLength = isCustomBay 
            ? getPricingDim(type, "length", "custom", rawBayVal) 
            : rawBayVal;
          const displayLength = isCustomBay ? `${rawBayVal}"` : `${rawBayVal}"`;

          const pPrice =
            MOCK_PRICING.wall.plates[`${pricingLength}-${layerPricingBreadth}`]?.[
              d.plateGauge
            ] || 0;
          const gaugeLabel =
            d.plateGauge === "22D" ? "22G (Double Part)" : `${d.plateGauge}G`;
          const pLabel = `${displayLength}x${layerDisplayBreadth} Plate (${gaugeLabel})`;
          if (!wPlatesGrp[pLabel]) wPlatesGrp[pLabel] = { qty: 0, price: pPrice };
          wPlatesGrp[pLabel].qty += qty;
          itemPlatesCost += qty * pPrice;

          if (d.hasStopper) {
            const stopperSize = WALL_STOPPER_MAP[pricingLength];
            const stPrice = MOCK_PRICING.wall.stoppers[stopperSize] || 0;
            const stLabel = isCustomBay ? `${rawBayVal}" Stopper` : `${stopperSize}ft Stopper`;
            if (!wStoppersGrp[stLabel])
              wStoppersGrp[stLabel] = { qty: 0, price: stPrice };
            wStoppersGrp[stLabel].qty += qty;
            itemStoppersCost += qty * stPrice;
          }
        });
      }

      itemTotal =
        channels * cPrice +
        itemPlatesCost +
        itemStoppersCost +
        itemBracketsCost +
        screws * MOCK_PRICING.wall.hardware.screw;
    }

    // === GONDOLA RACK LOGIC ===
    else if (type === "gondola") {
      const pricingHeight = getPricingDim(type, "height", d.height, d.customHeight);
      const displayHeight = d.height === "custom" ? `${d.customHeight}"` : `${d.height}ft`;

      const isDouble = d.isDoubleSided;
      const mult = isDouble ? 2 : 1;

      // 1. Stands — shared between bays: (bays.length + 1) stands per row
      const standsQty = (bays.length + 1) * qty;
      const sPrice =
        MOCK_PRICING.gondola.stands[pricingHeight][isDouble ? "double" : "single"];
      const sLabel = `${displayHeight} Gondola Stand (${isDouble ? "Double" : "Single"} Sided)`;
      if (!gStandsGrp[sLabel]) gStandsGrp[sLabel] = { qty: 0, price: sPrice };
      gStandsGrp[sLabel].qty += standsQty;

      // 2. Buffers — 2 per stand
      gBuffers += 2 * standsQty;

      let itemPlatesCost = 0;
      let itemBracketsCost = 0;
      let itemStoppersCost = 0;
      let itemCladdingCost = 0;
      let itemBottomsCost = 0;

      // 3. Per-bay material (cladding, bottoms, plates, brackets, stoppers)
      bays.forEach((bay) => {
        const isCustomBay = typeof bay === "object" && bay.isCustom;
        const rawBayVal = isCustomBay ? bay.val : bay;
        const pricingLength = isCustomBay
          ? getPricingDim(type, "length", "custom", rawBayVal)
          : rawBayVal;
        const displayLength = isCustomBay ? `${rawBayVal}"` : `${rawBayVal}ft`;
        const numLengthFt = isCustomBay ? parseFloat(rawBayVal) / 12 : parseFloat(rawBayVal);
        const numHeightFt = d.height === "custom" ? parseFloat(d.customHeight) / 12 : parseFloat(d.height);

        // Cladding
        const claddingAreaSqFt = numLengthFt * numHeightFt;
        const cRate = MOCK_PRICING.gondola.rates.claddingPerSqFt;
        const cPrice = Math.round(claddingAreaSqFt * cRate);
        const cLabel = `${displayLength} W x ${displayHeight} H Gondola Cladding`;
        if (!gCladdingGrp[cLabel]) gCladdingGrp[cLabel] = { qty: 0, price: cPrice };
        gCladdingGrp[cLabel].qty += mult * qty;
        itemCladdingCost += mult * qty * cPrice;

        // Bottom Base Deck
        const bPrice = MOCK_PRICING.gondola.bottoms[pricingLength];
        const bLabel = `${displayLength} Gondola Bottom Base`;
        if (!gBottomsGrp[bLabel]) gBottomsGrp[bLabel] = { qty: 0, price: bPrice };
        gBottomsGrp[bLabel].qty += mult * qty;
        itemBottomsCost += mult * qty * bPrice;

        // Plates, Brackets & Stoppers (per layer)
        for (let s = 0; s < shelvesPerRack; s++) {
          const layerBreadthRaw = (d.useCustomBreadths && Array.isArray(d.customBreadths) && d.customBreadths[s] !== undefined)
            ? d.customBreadths[s]
            : d.breadth;
          const layerCustomVal = (d.useCustomBreadths && Array.isArray(d.customBreadthsVals) && d.customBreadthsVals[s] !== undefined)
            ? d.customBreadthsVals[s]
            : (d.customBreadth || "10");
          const layerPricingBreadth = getPricingDim(type, "breadth", layerBreadthRaw, layerCustomVal);
          const layerDisplayBreadth = layerBreadthRaw === "custom" ? `${layerCustomVal}"` : `${layerBreadthRaw}"`;

          const layerPlates = mult * qty;
          const plateLenInchesPricing = String(pricingLength) === "3" ? "35.5" : "47.5";
          const plateLenInchesDisplay = isCustomBay ? `${rawBayVal - 0.5}` : plateLenInchesPricing;
          const pPrice =
            MOCK_PRICING.wall.plates[`${plateLenInchesPricing}-${layerPricingBreadth}`]?.[
              d.plateGauge
            ] || 0;

          const gaugeLabel = d.plateGauge === "22D" ? "22G (Double Part)" : `${d.plateGauge}G`;
          const pLabel = `${plateLenInchesDisplay}"x${layerDisplayBreadth} Plate (${gaugeLabel})`;
          if (!gPlatesGrp[pLabel]) gPlatesGrp[pLabel] = { qty: 0, price: pPrice };
          gPlatesGrp[pLabel].qty += layerPlates;
          itemPlatesCost += layerPlates * pPrice;

          const layerBrackets = 2 * layerPlates;
          const bracketSize = WALL_BRACKET_MAP[layerPricingBreadth];
          const actualBreadth = parseFloat(layerBreadthRaw === "custom" ? layerCustomVal : layerBreadthRaw);
          const displayBracket = actualBreadth + 0.75;
          const brPrice = MOCK_PRICING.wall.brackets[bracketSize] || 0;
          const brLabel = `${displayBracket}" Bracket`;
          if (!gBracketsGrp[brLabel]) gBracketsGrp[brLabel] = { qty: 0, price: brPrice };
          gBracketsGrp[brLabel].qty += layerBrackets;
          itemBracketsCost += layerBrackets * brPrice;

          if (d.hasStopper) {
            const stPrice = MOCK_PRICING.wall.stoppers[pricingLength] || 0;
            const stLabel = `${displayLength} Stopper`;
            if (!gStoppersGrp[stLabel]) gStoppersGrp[stLabel] = { qty: 0, price: stPrice };
            gStoppersGrp[stLabel].qty += layerPlates;
            itemStoppersCost += layerPlates * stPrice;
          }
        }
      });

      itemTotal =
        standsQty * sPrice +
        2 * standsQty * MOCK_PRICING.gondola.hardware.buffer +
        itemCladdingCost +
        itemBottomsCost +
        itemPlatesCost +
        itemBracketsCost +
        itemStoppersCost;
    }
    if (item.isCustomPart) {
      return {
        ...item,
        partPrice: Math.round(item.partPrice * m * 100) / 100, // Round to 2 decimals
        itemTotal: Math.round(item.itemTotal * m * 100) / 100,
      };
    }

    return { ...item, itemTotal: Math.round(itemTotal * m * 100) / 100 };
  });

  const mapOverrides = (group) =>
    Object.entries(group).map(([label, data]) => {
      const finalQty =
        overrides[label] !== undefined ? overrides[label] : data.qty;
      const unitPrice = Math.round(data.price * m * 100) / 100; // Round to 2 decimals
      return {
        label,
        baseQty: data.qty,
        qty: finalQty || 0,
        unitPrice: unitPrice,
        total: (finalQty || 0) * unitPrice,
      };
    });

  // Map parts
  const dSlottedPlates = mapOverrides(sPlatesGrp);
  const dSlottedAngles = mapOverrides(sAnglesGrp);
  const dPigeonPlates = mapOverrides(pPlatesGrp);
  const dPigeonAngles = mapOverrides(pAnglesGrp);
  const dPigeonCladding = mapOverrides(pCladdingGrp);
  const dPigeonDividers = mapOverrides(pDividersGrp);
  const dPigeonStoppers = mapOverrides(pStoppersGrp);
  const dWallPlates = mapOverrides(wPlatesGrp);
  const dWallChannels = mapOverrides(wChannelsGrp);
  const dWallBrackets = mapOverrides(wBracketsGrp);
  const dWallStoppers = mapOverrides(wStoppersGrp);
  const dGondolaStands = mapOverrides(gStandsGrp);
  const dGondolaPlates = mapOverrides(gPlatesGrp);
  const dGondolaBrackets = mapOverrides(gBracketsGrp);
  const dGondolaStoppers = mapOverrides(gStoppersGrp);
  const dGondolaCladding = mapOverrides(gCladdingGrp);
  const dGondolaBottoms = mapOverrides(gBottomsGrp);

  // Isolate hardware with specific override keys to prevent overlap
  const fSlottedBolts =
    overrides.slottedBolts !== undefined ? overrides.slottedBolts : sBolts;
  const fSlottedCorners =
    overrides.slottedCorners !== undefined
      ? overrides.slottedCorners
      : sCorners;
  const fSlottedBushes =
    overrides.slottedBushes !== undefined ? overrides.slottedBushes : sBushes;

  const fPigeonBolts =
    overrides.pigeonBolts !== undefined ? overrides.pigeonBolts : pBolts;
  const fPigeonCorners =
    overrides.pigeonCorners !== undefined ? overrides.pigeonCorners : pCorners;
  const fPigeonBushes =
    overrides.pigeonBushes !== undefined ? overrides.pigeonBushes : pBushes;

  const fWallScrews =
    overrides.wallScrews !== undefined ? overrides.wallScrews : wScrews;

  const fGondolaBuffers =
    overrides.gondolaBuffers !== undefined
      ? overrides.gondolaBuffers
      : gBuffers;

  const hwPrice = (val) => Math.round(val * m * 100) / 100; // Round to 2 decimals
  const hardwarePrices = {
    bolt: hwPrice(MOCK_PRICING.slotted.hardware.bolt),
    corner: hwPrice(MOCK_PRICING.slotted.hardware.corner),
    bush: hwPrice(MOCK_PRICING.slotted.hardware.bush),
    screw: hwPrice(MOCK_PRICING.wall.hardware.screw),
    buffer: hwPrice(MOCK_PRICING.gondola.hardware.buffer),
  };

  const sumTotal = (arr) => arr.reduce((sum, item) => sum + item.total, 0);

  const materialCost =
    sumTotal(dSlottedPlates) +
    sumTotal(dSlottedAngles) +
    sumTotal(dPigeonPlates) +
    sumTotal(dPigeonAngles) +
    sumTotal(dPigeonCladding) +
    sumTotal(dPigeonDividers) +
    sumTotal(dPigeonStoppers) +
    sumTotal(dWallPlates) +
    sumTotal(dWallChannels) +
    sumTotal(dWallBrackets) +
    sumTotal(dWallStoppers) +
    sumTotal(dGondolaStands) +
    sumTotal(dGondolaPlates) +
    sumTotal(dGondolaBrackets) +
    sumTotal(dGondolaStoppers) +
    sumTotal(dGondolaCladding) +
    sumTotal(dGondolaBottoms) +
    fSlottedBolts * hardwarePrices.bolt +
    fSlottedCorners * hardwarePrices.corner +
    fSlottedBushes * hardwarePrices.bush +
    fPigeonBolts * hardwarePrices.bolt +
    fPigeonCorners * hardwarePrices.corner +
    fPigeonBushes * hardwarePrices.bush +
    fWallScrews * hardwarePrices.screw +
    fGondolaBuffers * hardwarePrices.buffer;

  // Track if hardware exists so the sections stay open even if plates are removed
  const sHasItems =
    dSlottedPlates.length > 0 ||
    dSlottedAngles.length > 0 ||
    fSlottedBolts > 0 ||
    fSlottedCorners > 0 ||
    fSlottedBushes > 0;
  const pHasItems =
    dPigeonPlates.length > 0 ||
    dPigeonAngles.length > 0 ||
    dPigeonCladding.length > 0 ||
    dPigeonDividers.length > 0 ||
    dPigeonStoppers.length > 0 ||
    fPigeonBolts > 0 ||
    fPigeonCorners > 0 ||
    fPigeonBushes > 0;
  const wHasItems =
    dWallPlates.length > 0 ||
    dWallChannels.length > 0 ||
    dWallBrackets.length > 0 ||
    dWallStoppers.length > 0 ||
    fWallScrews > 0;
  const gHasItems =
    dGondolaStands.length > 0 ||
    dGondolaPlates.length > 0 ||
    dGondolaCladding.length > 0 ||
    dGondolaBottoms.length > 0;

  // Calculate Fitting Costs & Rent WITH Markup applied
  const activeSRate = parseInt(slottedFittingRate) || 0;
  const activeWRate = parseInt(wallFittingRate) || 0;

  // Apply the 9% multiplier (m) to the final calculated costs
  const activeRent = Math.round((parseInt(rickshawRent) || 0) * m);
  const sFittingCost = isFittingOpted
    ? Math.round(totalSlottedPlates * activeSRate * m)
    : 0;
  const wFittingCost = isFittingOpted
    ? Math.round(totalWallChannels * activeWRate * m)
    : 0;
  const pFittingCost = isFittingOpted && pHasItems
    ? Math.round((parseFloat(pigeonFittingCharge) || 0) * m)
    : 0;
  const gFittingCost =
    isFittingOpted && gHasItems
      ? Math.round((parseFloat(gondolaFittingCharge) || 0) * m)
      : 0;

  // We also export the 'marked up' rate so the unit cost in the PDF prints correctly
  const m_activeSRate = Math.round(activeSRate * m * 100) / 100;
  const m_activeWRate = Math.round(activeWRate * m * 100) / 100;

  return {
    slotted: {
      plates: dSlottedPlates,
      angles: dSlottedAngles,
      bolts: fSlottedBolts,
      corners: fSlottedCorners,
      bushes: fSlottedBushes,
      hasItems: sHasItems,
    },
    pigeon: {
      plates: dPigeonPlates,
      angles: dPigeonAngles,
      cladding: dPigeonCladding,
      dividers: dPigeonDividers,
      stoppers: dPigeonStoppers,
      bolts: fPigeonBolts,
      corners: fPigeonCorners,
      bushes: fPigeonBushes,
      hasItems: pHasItems,
    },
    wall: {
      plates: dWallPlates,
      channels: dWallChannels,
      brackets: dWallBrackets,
      stoppers: dWallStoppers,
      screws: fWallScrews,
      hasItems: wHasItems,
    },
    gondola: {
      stands: dGondolaStands,
      plates: dGondolaPlates,
      brackets: dGondolaBrackets,
      stoppers: dGondolaStoppers,
      cladding: dGondolaCladding,
      bottoms: dGondolaBottoms,
      buffers: fGondolaBuffers,
      hasItems: gHasItems,
    },
    charges: {
      sFittingCost,
      sFittingRate: m_activeSRate, // Output the marked-up unit rate
      totalSlottedPlates,

      wFittingCost,
      wFittingRate: m_activeWRate, // Output the marked-up unit rate
      totalWallChannels,

      pFittingCost,

      gFittingCost,
      rentCost: activeRent, // Marked up rent
    },
    hardwarePrices,
    grandTotal:
      materialCost +
      sFittingCost +
      wFittingCost +
      pFittingCost +
      gFittingCost +
      activeRent,
    hasOverrides: Object.keys(overrides).length > 0,
    enrichedCart,
  };
};
