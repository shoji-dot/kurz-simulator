import { useState } from 'react';

function Foo({ surgicalCase, product, placement }: any) {
  const [groundTruthJson, setGroundTruthJson] = useState<string | null>(null);
  const [groundTruthCopied, setGroundTruthCopied] = useState(false);
  const coordDebug = true;
  return (
    <div style={{ width: '100%' }}>
    {coordDebug && (
      <div
        style={{ position: 'absolute' }}
      >
        <div>label</div>
        <div style={{ marginTop: 8, pointerEvents: 'auto' }}>
          <div>Ground Truth Export</div>
          <button
            type="button"
            onClick={() => {
              const record = { a: 1 };
              const json = JSON.stringify(record, null, 2);
              setGroundTruthJson(json);
              setGroundTruthCopied(false);
              if ((navigator as any).clipboard?.writeText) {
                (navigator as any).clipboard.writeText(json)
                  .then(() => setGroundTruthCopied(true))
                  .catch(() => setGroundTruthCopied(false));
              }
            }}
            style={{ fontFamily: 'monospace' }}
          >
            {groundTruthCopied ? 'Copied!' : 'Copy JSON'}
          </button>
          {groundTruthJson && (
            <pre
              style={{ marginTop: 4 }}
            >
              {groundTruthJson}
            </pre>
          )}
        </div>
      </div>
    )}
    <div>after</div>
    </div>
  );
}
export default Foo;
