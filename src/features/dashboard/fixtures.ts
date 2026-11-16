import type { TableStatus } from "@/components/ui/table-status";
// Fictional UI fixtures only. Never used for database seeding or financial reports.
export const demoTables: {
  id: string;
  name: string;
  type: string;
  status: TableStatus;
  elapsed: string;
  amount: number;
}[] = [
  {
    id: "01",
    name: "The Classic",
    type: "Snooker · Full size",
    status: "occupied",
    elapsed: "01:24:00",
    amount: 700,
  },
  {
    id: "02",
    name: "Corner Pocket",
    type: "Snooker · Full size",
    status: "available",
    elapsed: "—",
    amount: 0,
  },
  {
    id: "03",
    name: "The Masters",
    type: "Snooker · Full size",
    status: "occupied",
    elapsed: "00:46:00",
    amount: 384,
  },
  {
    id: "04",
    name: "Eight Ball",
    type: "Pool · 8 ft",
    status: "reserved",
    elapsed: "—",
    amount: 0,
  },
  {
    id: "05",
    name: "The Break",
    type: "Pool · 8 ft",
    status: "available",
    elapsed: "—",
    amount: 0,
  },
  {
    id: "06",
    name: "Club Special",
    type: "Snooker · Full size",
    status: "maintenance",
    elapsed: "—",
    amount: 0,
  },
];
export const demoOrders = [
  {
    id: "ORD-024",
    items: "2 Cappuccino, 1 Club sandwich",
    table: "Table 01",
    status: "Preparing",
    amount: 740,
  },
  {
    id: "ORD-023",
    items: "1 Iced latte, 2 French fries",
    table: "Walk-in",
    status: "Ready",
    amount: 620,
  },
  {
    id: "ORD-022",
    items: "2 Masala tea",
    table: "Table 03",
    status: "Served",
    amount: 160,
  },
];
export const demoRevenue = [
  { time: "10 am", snooker: 400, cafe: 180 },
  { time: "12 pm", snooker: 1300, cafe: 650 },
  { time: "2 pm", snooker: 950, cafe: 400 },
  { time: "4 pm", snooker: 2200, cafe: 1100 },
  { time: "6 pm", snooker: 1900, cafe: 850 },
  { time: "8 pm", snooker: 3100, cafe: 1400 },
  { time: "10 pm", snooker: 2500, cafe: 1000 },
];
