import { PrismaClient, Stage, RiskLevel, ApprovalStatus } from '@prisma/client';
import { CalibratedOrderFixture } from '../types';

export class StressGenerator {
  /**
   * Generates synthetic orders and high-volume daily shift logs for stress testing
   * database query latency, indices, and pagination under high load.
   */
  static generateStressOrders(count = 25, anchorDate: Date): CalibratedOrderFixture[] {
    const orders: CalibratedOrderFixture[] = [];
    const styles = [
      'Slub Jersey Polo',
      'French Terry Jogger',
      'Drop Shoulder Graphic Tee',
      'Heavyweight 240 GSM Tee',
      'Interlock Zip Cardigan',
      'Organic Baby Rib Bodysuit',
      'Modal Spandex Lounge Top',
      'Honeycomb Pique Tennis Shirt',
    ];

    const buyers = ['COMPANY_B', 'COMPANY_C'];
    const units = ['UNIT_1', 'UNIT_2', 'UNIT_3'];
    const stages: Stage[] = [
      Stage.KNITTING,
      Stage.DYEING_WASHING,
      Stage.PRINTING,
      Stage.CUTTING,
      Stage.STITCHING,
      Stage.CHECKING,
      Stage.FINISHING,
    ];

    const operators = [
      'supervisor.muthu@company-a.com',
      'supervisor.selvam@company-a.com',
    ];

    for (let i = 1; i <= count; i++) {
      const poNumber = `STRESS-PO-${10000 + i}`;
      const buyerCode = buyers[i % buyers.length];
      const unitCode = units[i % units.length];
      const style = `${styles[i % styles.length]} #${i}`;
      const totalQty = 2000 + (i * 350) % 15000;
      const exFactoryDaysOut = 5 + (i * 3) % 45;
      
      const exFactoryDate = new Date(anchorDate);
      exFactoryDate.setDate(exFactoryDate.getDate() + exFactoryDaysOut);

      // Distribute stages
      const activeStageIndex = (i % 6) + 1; // Stage 1 to 6
      const orderLines = [
        { size: 'S', color: 'Black', plannedQty: Math.floor(totalQty * 0.3) },
        { size: 'M', color: 'Black', plannedQty: Math.floor(totalQty * 0.4) },
        { size: 'L', color: 'Black', plannedQty: totalQty - Math.floor(totalQty * 0.3) - Math.floor(totalQty * 0.4) },
      ];

      const milestones = stages.map((stg, sIdx) => {
        const sequenceOrder = sIdx + 1;
        let completed = 0;
        if (sequenceOrder < activeStageIndex) {
          completed = totalQty;
        } else if (sequenceOrder === activeStageIndex) {
          completed = Math.floor(totalQty * ((i % 7) / 10 + 0.2));
        }

        return {
          stage: stg,
          sequenceOrder,
          plannedStartOffsetDays: (sequenceOrder - 4) * 5,
          plannedEndOffsetDays: (sequenceOrder - 3) * 5,
          bufferDaysAhead: Math.max(0, (7 - sequenceOrder) * 2),
          targetQuantity: totalQty,
          completedQuantity: completed,
          unitCode: sequenceOrder === 3 ? 'PRINTTEX' : unitCode,
        };
      });

      // Generate multi-day logs for active stage
      const dailyLogs = [];
      const numLogs = 3 + (i % 8);
      for (let d = 0; d < numLogs; d++) {
        const completedQty = Math.floor(totalQty / 20) + ((d * 37) % 50);
        dailyLogs.push({
          dateOffsetDays: -numLogs + d,
          completedQty,
          reworkQty: Math.floor(completedQty * 0.03),
          rejectedQty: Math.floor(completedQty * 0.01),
          stage: stages[activeStageIndex - 1],
          unitCode,
          userEmail: operators[d % operators.length],
          shift: d % 2 === 0 ? 'Shift A' : 'Shift B',
          operatorNotes: `Synthetic stress telemetry record [Order ${poNumber}, Shift ${d + 1}]`,
        });
      }

      orders.push({
        poNumber,
        buyerCode,
        unitCode,
        style,
        description: `Synthetic stress dataset for load & latency validation - ${style}`,
        totalQuantity: totalQty,
        fobPricePerPiece: 6.5 + (i % 10) * 0.5,
        currency: buyerCode === 'COMPANY_B' ? 'GBP' : 'EUR',
        exchangeRate: buyerCode === 'COMPANY_B' ? 105.5 : 90.25,
        exFactoryDateStr: exFactoryDate.toISOString(),
        orderLines,
        milestones,
        dailyLogs,
      });
    }

    return orders;
  }
}
