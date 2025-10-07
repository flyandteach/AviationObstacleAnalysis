import SummaryCards from '../SummaryCards';

export default function SummaryCardsExample() {
  return (
    <div className="p-6">
      <SummaryCards
        totalObstacles={1247}
        airportsChecked={16}
        penetrations={8}
        warnings={23}
      />
    </div>
  );
}
