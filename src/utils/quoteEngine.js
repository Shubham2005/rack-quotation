import {
  MOCK_PRICING,
  WALL_BRACKET_MAP,
  WALL_STOPPER_MAP,
} from "../constants/pricing";

export const calculateQuote = ({
  cart,
  overrides,
  slottedFittingRate,
  wallFittingRate,
  pigeonFittingRate,
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
  let totalPigeonFittingParts = 0;

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
      const angles = channelsOrAnglesCount * 2 * qty;
      const bolts = angles * (shelvesPerRack >= 2 ? 2 * shelvesPerRack + 4 : 8);
      sBolts += bolts;
      sCorners += angles * 2;
      sBushes += angles;

      const aPrice =
        (MOCK_PRICING.slotted.angles[d.height]?.[d.angleGauge] || 0) +
        (d.angleColor === "custom"
          ? MOCK_PRICING.slotted.colorSurcharge.angles[d.height] || 0
          : 0);
      const aLabel = `${d.height}ft Angle (${d.angleGauge}G)${d.angleColor === "custom" ? ` - Custom Color` : ""}`;
      if (!sAnglesGrp[aLabel]) sAnglesGrp[aLabel] = { qty: 0, price: aPrice };
      sAnglesGrp[aLabel].qty += angles;

      let itemPlatesCost = 0;
      bays.forEach((bayLength) => {
        const pPrice =
          (MOCK_PRICING.slotted.plates[`${bayLength}-${d.breadth}`]?.[
            d.plateGauge
          ] || 0) +
          (d.plateColor === "custom"
            ? MOCK_PRICING.slotted.colorSurcharge.plates[
                `${bayLength}-${d.breadth}`
              ] || 0
            : 0);
        const pLabel = `${bayLength}'x${d.breadth}" Plate (${d.plateGauge}G)${d.plateColor === "custom" ? ` - Custom Color` : ""}`;
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
      const angles = 4 * qty;
      const verticalDividerLines = d.columns - 1;
      const spacesBetweenPlates = Math.max(1, shelvesPerRack - 1);
      const totalIndividualDividers =
        verticalDividerLines * spacesBetweenPlates;

      const baseBolts =
        angles * (shelvesPerRack >= 2 ? 2 * shelvesPerRack + 4 : 8);
      const extraBolts = 2 * shelvesPerRack * verticalDividerLines * qty;
      const bolts = baseBolts + extraBolts;

      const corners = 4 * qty;
      const bushes = 4 * qty;

      pBolts += bolts;
      pCorners += corners;
      pBushes += bushes;

      const aPrice = MOCK_PRICING.slotted.angles[d.height]?.[d.angleGauge] || 0;
      const aLabel = `${d.height}ft Angle (${d.angleGauge}G)`;
      if (!pAnglesGrp[aLabel]) pAnglesGrp[aLabel] = { qty: 0, price: aPrice };
      pAnglesGrp[aLabel].qty += angles;

      const pPrice =
        MOCK_PRICING.slotted.plates[`${bays[0]}-${d.breadth}`]?.[
          d.plateGauge
        ] || 0;
      const pLabel = `${bays[0]}'x${d.breadth}" Plate (${d.plateGauge}G)`;
      if (!pPlatesGrp[pLabel]) pPlatesGrp[pLabel] = { qty: 0, price: pPrice };
      pPlatesGrp[pLabel].qty += totalPlatesInRow;

      // Cladding Sheets
      const backAreaSqFt = bays[0] * parseFloat(d.height);
      const sideAreaSqFt = (parseFloat(d.breadth) / 12) * parseFloat(d.height);
      const claddingRate = MOCK_PRICING.pigeon.rates.claddingPerSqFt;

      const backPrice = Math.round(backAreaSqFt * claddingRate);
      const backLabel = `${bays[0]}ft x ${d.height}ft Back Cladding`;
      if (!pCladdingGrp[backLabel])
        pCladdingGrp[backLabel] = { qty: 0, price: backPrice };
      pCladdingGrp[backLabel].qty += 1 * qty;

      const sidePrice = Math.round(sideAreaSqFt * claddingRate);
      const sideLabel = `${d.breadth}" x ${d.height}ft Side Cladding`;
      if (!pCladdingGrp[sideLabel])
        pCladdingGrp[sideLabel] = { qty: 0, price: sidePrice };
      pCladdingGrp[sideLabel].qty += 2 * qty;
      const claddingCost = backPrice * 1 * qty + sidePrice * 2 * qty;

      // Vertical Dividers
      let dividerCost = 0;
      if (totalIndividualDividers > 0) {
        const dividerHeightFt =
          (parseFloat(d.height) - 0.25) / spacesBetweenPlates;
        const divAreaSqFt = (parseFloat(d.breadth) / 12) * dividerHeightFt;
        const dividerRate = MOCK_PRICING.pigeon.rates.dividerPerSqFt;

        const divPrice = Math.round(divAreaSqFt * dividerRate);
        const divLabel = `${d.breadth}" x ${(dividerHeightFt * 12).toFixed(1)}" Divider`;
        if (!pDividersGrp[divLabel])
          pDividersGrp[divLabel] = { qty: 0, price: divPrice };
        pDividersGrp[divLabel].qty += totalIndividualDividers * qty;
        dividerCost = totalIndividualDividers * divPrice * qty;
      }

      // Stoppers
      let stopperCost = 0;
      if (d.hasStopper && shelvesPerRack > 1) {
        const stopperRows = shelvesPerRack - 1;
        const stopperAreaSqFt = (3 / 12) * parseFloat(bays[0]);
        const stopperRate = MOCK_PRICING.pigeon.rates.stopperPerSqFt;

        const stopperPrice = Math.round(stopperAreaSqFt * stopperRate);
        const stLabel = `${bays[0]}ft x 3" Stopper`;
        if (!pStoppersGrp[stLabel])
          pStoppersGrp[stLabel] = { qty: 0, price: stopperPrice };
        pStoppersGrp[stLabel].qty += stopperRows * qty;
        stopperCost = stopperRows * stopperPrice * qty;
      }

      totalPigeonFittingParts +=
        (shelvesPerRack + totalIndividualDividers + 3) * qty;

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
      const channels = channelsOrAnglesCount * qty;
      totalWallChannels += channels;

      const cPrice = MOCK_PRICING.wall.channels[d.height] || 0;
      const cLabel = `${d.height}ft Channel`;
      if (!wChannelsGrp[cLabel])
        wChannelsGrp[cLabel] = { qty: 0, price: cPrice };
      wChannelsGrp[cLabel].qty += channels;

      const screws = channels * (d.height === "4" ? 5 : 7);
      wScrews += screws;

      const brackets =
        (channelsOrAnglesCount +
          (d.hasStopper ? Math.max(0, bays.length - 1) : 0)) *
        shelvesPerRack *
        qty;
      const bracketSize = WALL_BRACKET_MAP[d.breadth];
      const bPrice = MOCK_PRICING.wall.brackets[bracketSize] || 0;
      const bLabel = `${bracketSize}" Bracket`;
      if (!wBracketsGrp[bLabel])
        wBracketsGrp[bLabel] = { qty: 0, price: bPrice };
      wBracketsGrp[bLabel].qty += brackets;

      let itemPlatesCost = 0;
      let itemStoppersCost = 0;
      bays.forEach((bayLength) => {
        const pPrice =
          MOCK_PRICING.wall.plates[`${bayLength}-${d.breadth}`]?.[
            d.plateGauge
          ] || 0;
        const gaugeLabel =
          d.plateGauge === "22D" ? "22G (Double Part)" : `${d.plateGauge}G`;
        const pLabel = `${bayLength}"x${d.breadth}" Plate (${gaugeLabel})`;
        if (!wPlatesGrp[pLabel]) wPlatesGrp[pLabel] = { qty: 0, price: pPrice };
        wPlatesGrp[pLabel].qty += totalPlatesInRow;
        itemPlatesCost += totalPlatesInRow * pPrice;

        if (d.hasStopper) {
          const stopperSize = WALL_STOPPER_MAP[bayLength];
          const stPrice = MOCK_PRICING.wall.stoppers[stopperSize] || 0;
          const stLabel = `${stopperSize}ft Stopper`;
          if (!wStoppersGrp[stLabel])
            wStoppersGrp[stLabel] = { qty: 0, price: stPrice };
          wStoppersGrp[stLabel].qty += totalPlatesInRow;
          itemStoppersCost += totalPlatesInRow * stPrice;
        }
      });

      itemTotal =
        channels * cPrice +
        itemPlatesCost +
        itemStoppersCost +
        brackets * bPrice +
        screws * MOCK_PRICING.wall.hardware.screw;
    }

    // === GONDOLA RACK LOGIC ===
    else if (type === "gondola") {
      const isDouble = d.isDoubleSided;
      const mult = isDouble ? 2 : 1;
      const bayLength = bays[0]; // Strict standalone (3 or 4)

      // 1. Stands
      const standsQty = 2 * qty;
      const sPrice =
        MOCK_PRICING.gondola.stands[d.height][isDouble ? "double" : "single"];
      const sLabel = `${d.height}ft Gondola Stand (${isDouble ? "Double" : "Single"} Sided)`;
      if (!gStandsGrp[sLabel]) gStandsGrp[sLabel] = { qty: 0, price: sPrice };
      gStandsGrp[sLabel].qty += standsQty;

      // 2. Buffers
      gBuffers += 4 * qty;

      // 3. Cladding
      const claddingAreaSqFt = bayLength * parseFloat(d.height);
      const cRate = MOCK_PRICING.gondola.rates.claddingPerSqFt;
      const cPrice = Math.round(claddingAreaSqFt * cRate);
      const cLabel = `${bayLength}ft W x ${d.height}ft H Gondola Cladding`;
      if (!gCladdingGrp[cLabel])
        gCladdingGrp[cLabel] = { qty: 0, price: cPrice };
      gCladdingGrp[cLabel].qty += mult * qty;

      // 4. Bottom Base Decks
      const bPrice = MOCK_PRICING.gondola.bottoms[bayLength];
      const bLabel = `${bayLength}ft Gondola Bottom Base`;
      if (!gBottomsGrp[bLabel]) gBottomsGrp[bLabel] = { qty: 0, price: bPrice };
      gBottomsGrp[bLabel].qty += mult * qty;

      // 5. Plates & Brackets (Mapped to Wall Pricing)
      const totalPlates = shelvesPerRack * mult * qty;
      const plateLenInches = bayLength === 3 ? "35.5" : "47.5"; // Map to wall inches
      const pPrice =
        MOCK_PRICING.wall.plates[`${plateLenInches}-${d.breadth}`]?.[
          d.plateGauge
        ] || 0;

      const gaugeLabel =
        d.plateGauge === "22D" ? "22G (Double)" : `${d.plateGauge}G`;
      const pLabel = `${plateLenInches}"x${d.breadth}" Plate (${gaugeLabel})`;
      if (!gPlatesGrp[pLabel]) gPlatesGrp[pLabel] = { qty: 0, price: pPrice };
      gPlatesGrp[pLabel].qty += totalPlates;

      const totalBrackets = 2 * totalPlates; // 2 brackets per plate
      const bracketSize = WALL_BRACKET_MAP[d.breadth];
      const brPrice = MOCK_PRICING.wall.brackets[bracketSize] || 0;
      const brLabel = `${bracketSize}" Bracket`;
      if (!gBracketsGrp[brLabel])
        gBracketsGrp[brLabel] = { qty: 0, price: brPrice };
      gBracketsGrp[brLabel].qty += totalBrackets;

      // 6. Stoppers
      let itemStoppersCost = 0;
      if (d.hasStopper) {
        const stPrice = MOCK_PRICING.wall.stoppers[bayLength] || 0;
        const stLabel = `${bayLength}ft Stopper`;
        if (!gStoppersGrp[stLabel])
          gStoppersGrp[stLabel] = { qty: 0, price: stPrice };
        gStoppersGrp[stLabel].qty += totalPlates;
        itemStoppersCost = totalPlates * stPrice;
      }

      itemTotal =
        standsQty * sPrice +
        4 * qty * MOCK_PRICING.gondola.hardware.buffer +
        mult * qty * cPrice +
        mult * qty * bPrice +
        totalPlates * pPrice +
        totalBrackets * brPrice +
        itemStoppersCost;
    }
    if (item.isCustomPart) {
      return {
        ...item,
        partPrice: Math.round(item.partPrice * m),
        itemTotal: Math.round(item.itemTotal * m),
      };
    }

    return { ...item, itemTotal: Math.round(itemTotal * m) };
  });

  const mapOverrides = (group) =>
    Object.entries(group).map(([label, data]) => {
      const finalQty =
        overrides[label] !== undefined ? overrides[label] : data.qty;
      const unitPrice = Math.round(data.price * m);
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

  const hwPrice = (val) => Math.round(val * m);
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

  // Calculate Fitting Costs (Now placed AFTER we know what items exist)
  const activeSRate = parseInt(slottedFittingRate) || 0;
  const activeWRate = parseInt(wallFittingRate) || 0;
  const activePRate = parseInt(pigeonFittingRate) || 0;
  const activeRent = parseInt(rickshawRent) || 0;

  const sFittingCost = isFittingOpted ? totalSlottedPlates * activeSRate : 0;
  const wFittingCost = isFittingOpted ? totalWallChannels * activeWRate : 0;
  const pFittingCost = isFittingOpted
    ? totalPigeonFittingParts * activePRate
    : 0;

  // NEW: Gondola Flat Fitting Cost
  const gFittingCost =
    isFittingOpted && gHasItems ? parseFloat(gondolaFittingCharge) || 0 : 0;

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
      sFittingRate: activeSRate,
      totalSlottedPlates,
      wFittingCost,
      wFittingRate: activeWRate,
      totalWallChannels,
      pFittingCost,
      pFittingRate: activePRate,
      totalPigeonFittingParts,
      gFittingCost,
      rentCost: activeRent,
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
