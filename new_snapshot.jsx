                  <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3 border-t border-gray-700 pt-6">
                    Itemized Specification
                  </h3>
                  {(() => {
                    let snapshotGrandTotal = 0;

                    const renderSnapshotItem = (
                      originalLabel,
                      qty,
                      baseRate,
                      baseTotal,
                      unit = "pc",
                    ) => {
                      if (qty > 0) {
                        const custom = invoiceOverrides[originalLabel] || {};
                        const displayLabel = custom.label !== undefined ? custom.label : originalLabel;
                        const inclusiveRate = custom.rate !== undefined ? custom.rate : baseRate;
                        const inclusiveTotal = inclusiveRate * qty;

                        snapshotGrandTotal += inclusiveTotal;

                        const divisor = applyMarkup ? 1.18 : 1;
                        const baseRateVal = inclusiveRate / divisor;
                        const baseTotalVal = inclusiveTotal / divisor;
                        const showInput = isEditInvoiceMode && !isCapturing;

                        return (
                          <li
                            key={`snap-item-${originalLabel}`}
                            className="flex sm:flex-row justify-between items-start sm:items-center border-b border-gray-800/50 py-1.5 gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              {showInput ? (
                                <input
                                  type="text"
                                  value={displayLabel}
                                  onChange={(e) =>
                                    handleInvoiceOverride(
                                      originalLabel,
                                      "label",
                                      e.target.value,
                                    )
                                  }
                                  className="bg-gray-800 border border-dashed border-amber-500/60 rounded px-2 py-0.5 text-xs text-amber-300 outline-none w-full max-w-[220px] focus:border-amber-400 font-medium"
                                />
                              ) : (
                                <span className="text-gray-200 leading-tight block">
                                  {displayLabel.includes(" - ") ? (
                                    <>
                                      {displayLabel.split(" - ")[0]}
                                      <span className="block text-[10px] text-blue-400 font-bold italic">
                                        — {displayLabel.split(" - ")[1]}
                                      </span>
                                    </>
                                  ) : (
                                    displayLabel
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 font-mono text-xs whitespace-nowrap self-end sm:self-center">
                              <span className="text-gray-400">
                                {qty}{unit} * ₹
                              </span>
                              {showInput ? (
                                <input
                                  type="number"
                                  value={
                                    baseRateVal === 0
                                      ? ""
                                      : parseFloat(baseRateVal.toFixed(2))
                                  }
                                  onChange={(e) =>
                                    handleInvoiceOverride(
                                      originalLabel,
                                      "rate",
                                      (parseFloat(e.target.value) || 0) * divisor,
                                    )
                                  }
                                  className="bg-gray-800 border border-dashed border-amber-500/60 rounded px-1.5 py-0.5 text-xs text-amber-300 text-right outline-none w-16 focus:border-amber-400 font-semibold"
                                />
                              ) : (
                                <span className="text-gray-300">
                                  {Math.round(baseRateVal * 100) / 100}
                                </span>
                              )}
                              <span className="text-gray-400"> = </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{Math.round(baseTotalVal * 100) / 100}
                              </strong>
                            </div>
                          </li>
                        );
                      }
                      return null;
                    };

                    return (
                      <>
                        <ul className="space-y-2 text-[14px] text-gray-200">
                          {/* PRINT SLOTTED PARTS */}
                          {quote.slotted.hasItems && (
                            <>
                              <li className="text-blue-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Slotted Angle Rack
                              </li>
                              {quote.slotted.plates.map((item) =>
                                renderSnapshotItem(item.label, item.qty, item.unitPrice, item.total)
                              )}
                              {quote.slotted.angles.map((item) =>
                                renderSnapshotItem(item.label, item.qty, item.unitPrice, item.total)
                              )}
                              {renderSnapshotItem("Nut/Bolts", quote.slotted.bolts, quote.hardwarePrices.bolt, quote.slotted.bolts * quote.hardwarePrices.bolt)}
                              {renderSnapshotItem("Corner Supports", quote.slotted.corners, quote.hardwarePrices.corner, quote.slotted.corners * quote.hardwarePrices.corner)}
                              {renderSnapshotItem("Rubber Bushes", quote.slotted.bushes, quote.hardwarePrices.bush, quote.slotted.bushes * quote.hardwarePrices.bush)}
                            </>
                          )}

                          {/* PRINT PIGEON PARTS */}
                          {quote.pigeon && quote.pigeon.hasItems && (
                            <>
                              <li className="text-orange-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Pigeon Hole Rack
                              </li>
                              {[...quote.pigeon.plates, ...quote.pigeon.angles, ...quote.pigeon.cladding, ...quote.pigeon.dividers, ...quote.pigeon.stoppers]
                                .map((item) => renderSnapshotItem(item.label, item.qty, item.unitPrice, item.total))}
                              {renderSnapshotItem("Nut/Bolts", quote.pigeon.bolts, quote.hardwarePrices.bolt, quote.pigeon.bolts * quote.hardwarePrices.bolt)}
                              {renderSnapshotItem("Corner Supports", quote.pigeon.corners, quote.hardwarePrices.corner, quote.pigeon.corners * quote.hardwarePrices.corner)}
                              {renderSnapshotItem("Rubber Bushes", quote.pigeon.bushes, quote.hardwarePrices.bush, quote.pigeon.bushes * quote.hardwarePrices.bush)}
                            </>
                          )}

                          {/* PRINT GONDOLA PARTS */}
                          {quote.gondola && quote.gondola.hasItems && (
                            <>
                              <li className="text-teal-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Gondola Rack
                              </li>
                              {[...quote.gondola.stands, ...quote.gondola.bottoms, ...quote.gondola.plates, ...quote.gondola.brackets, ...quote.gondola.cladding, ...quote.gondola.stoppers]
                                .map((item) => renderSnapshotItem(item.label, item.qty, item.unitPrice, item.total))}
                              {renderSnapshotItem("Rubber Buffers", quote.gondola.buffers, quote.hardwarePrices.buffer, quote.gondola.buffers * quote.hardwarePrices.buffer)}
                            </>
                          )}

                          {/* PRINT WALL MOUNTED PARTS */}
                          {quote.wall.hasItems && (
                            <>
                              <li className="text-indigo-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Wall Mounted Rack
                              </li>
                              {[...quote.wall.plates, ...quote.wall.channels, ...quote.wall.brackets, ...quote.wall.stoppers]
                                .map((item) => renderSnapshotItem(item.label, item.qty, item.unitPrice, item.total))}
                              {renderSnapshotItem("Screws", quote.wall.screws, quote.hardwarePrices.screw, quote.wall.screws * quote.hardwarePrices.screw)}
                            </>
                          )}

                          {/* PRINT CHARGES */}
                          {(quote.charges.sFittingCost > 0 || quote.charges.wFittingCost > 0 || quote.charges.pFittingCost > 0 || quote.charges.gFittingCost > 0 || quote.charges.rentCost > 0) && (
                            <>
                              <li className="text-gray-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Service & Logistics
                              </li>
                              {renderSnapshotItem("Slotted Fitting", quote.charges.totalSlottedPlates, quote.charges.sFittingRate, quote.charges.sFittingCost, " plate")}
                              {renderSnapshotItem("Wall Fitting", quote.charges.totalWallChannels, quote.charges.wFittingRate, quote.charges.wFittingCost, " ch.")}
                              {renderSnapshotItem("Pigeon Hole Fitting", 1, quote.charges.pFittingCost, quote.charges.pFittingCost, " Job")}
                              {renderSnapshotItem("Gondola Fitting", 1, quote.charges.gFittingCost, quote.charges.gFittingCost, " Job")}
                              {renderSnapshotItem("Delivery Charges", 1, quote.charges.rentCost, quote.charges.rentCost, " Job")}
                            </>
                          )}
                        </ul>

                        <div className="pt-2 mt-6">
                          {/* GST */}
                          {applyMarkup && (
                            <div className="flex justify-between items-end px-4 py-2 text-gray-300">
                              <span className="text-sm">GST (18%)</span>
                              <span className="font-mono text-sm">
                                ₹
                                {(
                                  Math.round(
                                    (snapshotGrandTotal - snapshotGrandTotal / 1.18) * 100
                                  ) / 100
                                ).toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-end bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <span className="text-lg font-medium text-gray-300">
                              Grand Total:
                            </span>
                            <span className="text-3xl font-bold text-green-400">
                              ₹{Math.round(snapshotGrandTotal).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
