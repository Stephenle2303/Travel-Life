import { indexJourneySupport, uniqueSupportJourney } from '@/reconstruction/journey-support-map';
import type { ReconstructionGraph } from '@/reconstruction/types';

function graph(size:number):ReconstructionGraph {
  return {ruleVersion:'reconstruction-v1',places:[],dispositions:[],memberships:[],possibleMerges:[],
    visits:Array.from({length:size},(_,i)=>({id:`visit-${i}`,placeId:'place',order:'ordered',evidenceIds:Array.from({length:30},(_,j)=>`evidence-${i}-${j}`)})),
    journeys:Array.from({length:size},(_,i)=>({id:`journey-${i}`,visitIds:[`visit-${i}`],state:'inferred'}))};
}

it('matches exhaustive complete-support authority including split, missing and overlapping targets',()=>{
  const input=graph(60);
  input.journeys.push({id:'overlap',visitIds:['visit-1','visit-2'],state:'inferred'});
  const visits=new Map(input.visits.map(visit=>[visit.id,visit]));
  const index=indexJourneySupport(input);
  const cases=[[],['missing'],['evidence-1-1'],['evidence-1-1','evidence-2-2'],['evidence-1-1','evidence-3-1'],
    ...Array.from({length:60},(_,i)=>[`evidence-${i}-1`,`evidence-${i}-2`])];
  for(const support of cases){
    const targets=input.journeys.filter(target=>support.every(id=>target.visitIds.some(visit=>visits.get(visit)?.evidenceIds.includes(id))));
    expect(uniqueSupportJourney(support,index)).toBe(support.length&&targets.length===1?targets[0].id:null);
  }
});

it('indexes dense multi-journey support once rather than scanning the graph per group',()=>{
  const input=graph(1000);let reads=0;
  for(const visit of input.visits){const ids=visit.evidenceIds;Object.defineProperty(visit,'evidenceIds',{get(){reads++;return ids;}});}
  const index=indexJourneySupport(input);
  for(let i=0;i<1000;i++)expect(uniqueSupportJourney(Array.from({length:30},(_,j)=>`evidence-${i}-${j}`),index)).toBe(`journey-${i}`);
  expect(reads).toBe(1000);
});
