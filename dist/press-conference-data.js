(function(){
  const category=(id,label,stages,target,weight,templates,requires='')=>({id,label,stages,target,weight,templates,requires});
  const library=window.VELMORA_PRESS_CONFERENCE_LIBRARY={
    version:'V95.0',
    questionsPerConference:4,
    questionRange:[3,5],
    answerRange:[3,5],
    categories:[
      category('PLAYER_FORM','PLAYER FORM',['pre','post'],'player',12,[
        "{player} has been one of the most discussed players around {club}. How would you assess their current form?",
        "Supporters have noticed a change in {player}'s performances. What are you seeing that the public may be missing?",
        "How important is {player} to what you are trying to build at {club}?",
        "Is {player} playing with the confidence you expect from someone in their role?",
        "What does {player} still need to improve to reach the level you believe is possible?",
        "There has been a lot of focus on {player} this week. Does that attention help or hinder them?"
      ]),
      category('SELECTION','TEAM SELECTION',['pre','post'],'player',11,[
        "Can you explain the thinking behind {player}'s recent place in the team?",
        "How close was the decision over whether to start {player} for this fixture?",
        "Are you asking {player} to perform a different role from the one supporters normally see?",
        "What message does your selection of {player} send to the rest of the squad?",
        "Do reputations matter when you choose the starting three, or is every place genuinely open?",
        "How much did training performance influence your decision on {player}?"
      ]),
      category('CAPTAINCY','CAPTAINCY',['pre','post'],'captain',9,[
        "What have you asked of {captain} as captain around this {competition} fixture?",
        "How does {captain} set the emotional tone inside the dressing room?",
        "Do you expect {captain} to challenge your decisions as well as support them?",
        "What separates {captain}'s leadership from the other senior voices at {club}?",
        "Has the captaincy changed the way {captain} plays?",
        "When pressure rises, what do you need to see from {captain}?"
      ]),
      category('BREAKTHROUGH','BREAKTHROUGH PLAYER',['pre','post'],'young',9,[
        "{player} is still developing. How do you protect that process while asking for senior-level performances?",
        "Is this the right moment for {player} to take on more responsibility?",
        "What convinced you that {player} was ready for this level?",
        "How do you keep the excitement around {player} from becoming unhelpful pressure?",
        "Could {player} become a central figure for {club} over the next few seasons?",
        "What is the next milestone you want {player} to reach?"
      ],'young'),
      category('SQUAD_MOOD','DRESSING ROOM',['pre','post'],'squad',11,[
        "How would you describe the mood in the {club} dressing room right now?",
        "Is this group pulling in the same direction, or are there difficult conversations taking place?",
        "What have you done this week to keep the squad focused on {opponent}?",
        "How much responsibility do the players take for maintaining standards between matches?",
        "Does healthy competition for places strengthen this squad or create tension?",
        "What tells you that the players still believe in the direction you have set?"
      ]),
      category('RECENT_FORM','RECENT FORM',['pre','post'],'form',13,[
        "Your recent sequence reads {form}. What is the honest story behind those results?",
        "Has the mood around {club} changed because of the recent run of form?",
        "Are the results a fair reflection of the performances you have been seeing?",
        "What have you learned about this squad during the last few matches?",
        "Do you need to change anything significant to alter the current momentum?",
        "How do you stop one result from becoming a longer-term pattern?"
      ]),
      category('MATCH_RESULT','MATCH RESULT',['post'],'result',15,[
        "What is your immediate assessment after {club}'s {result} against {opponent}?",
        "Where do you believe this match was won or lost?",
        "Did the {score} scoreline accurately reflect what happened today?",
        "What did your players execute well, and what fell below the required level?",
        "Was there a single moment that changed the direction of this match?",
        "How quickly can you separate the emotion of this result from the analysis it requires?"
      ]),
      category('TACTICS','TACTICAL PLAN',['pre','post'],'tactics',12,[
        "What is the key idea behind your {tactic} approach for {opponent}?",
        "Where do you believe the tactical contest will be decided?",
        "How much freedom will the players have to adapt once the match begins?",
        "Are you preparing to control possession, or to attack the spaces {opponent} leave?",
        "What did you identify in {opponent}'s structure that shaped your plan?",
        "Have recent performances made you reconsider any part of your preferred system?"
      ]),
      category('OPPONENT','THE OPPOSITION',['pre','post'],'opponent',12,[
        "What makes {opponent} a particularly difficult opponent?",
        "Is there one quality in {opponent}'s team that your players must respect?",
        "Do you see weaknesses in {opponent} that can be attacked consistently?",
        "How different is the challenge of {opponent} from your previous fixture?",
        "Would you describe {opponent} as a team you admire?",
        "What would a strong performance against {opponent} say about {club}'s progress?"
      ]),
      category('RIVAL_MANAGER','RIVAL MANAGER',['pre','post'],'rival',11,[
        "How would you describe your relationship with {rivalManager}?",
        "Do you enjoy the tactical contest against a manager such as {rivalManager}?",
        "Has anything {rivalManager} said before this match added motivation?",
        "Is there genuine respect between you and {rivalManager}, despite the competition?",
        "Do repeated meetings with {rivalManager} make these fixtures more personal?",
        "What do you believe separates your management style from {rivalManager}'s?"
      ],'rival'),
      category('BOARD','BOARD EXPECTATIONS',['pre','post'],'board',9,[
        "How much do the board's expectations influence your day-to-day decisions?",
        "The board relationship is currently described as {board}. Does that feel accurate to you?",
        "Do you feel you have been given enough support to deliver the club's objectives?",
        "Are the club's ambitions realistic for the squad currently available?",
        "How often do you speak with the board about the direction of {club}?",
        "Would you change your approach if the board demanded faster progress?"
      ]),
      category('TRANSFERS','TRANSFER POLICY',['pre','post'],'transfer',8,[
        "How satisfied are you with the balance of the squad after the club's recent transfer work?",
        "Are you expecting {club} to be active before the transfer window closes?",
        "How do you handle a player whose future becomes a public talking point?",
        "Would you rather add experience now or preserve a pathway for younger players?",
        "Can supporters expect the club to act if the right opportunity appears?",
        "How closely does recruitment need to match your preferred style of play?"
      ]),
      category('CONTRACTS','PLAYER CONTRACTS',['pre','post'],'contract',8,[
        "{player}'s contract situation has attracted attention. Are discussions affecting the player?",
        "How confident are you that {player}'s future can be resolved positively?",
        "Should a player with an uncertain contract remain central to your plans?",
        "Do contract questions ever become a distraction inside the dressing room?",
        "What does a player need to show before {club} commits to a new deal?",
        "How important is role clarity when you speak to {player} about the future?"
      ],'contract'),
      category('AVAILABILITY','INJURIES AND DISCIPLINE',['pre','post'],'unavailable',10,[
        "How has {player}'s absence changed your preparation for this match?",
        "Do you have enough depth to cope without {player}?",
        "Has the squad had to change its approach because {player} is unavailable?",
        "How do you keep an unavailable player involved with the group?",
        "Will this absence create an opportunity for someone else to establish themselves?",
        "Are you concerned that availability issues are beginning to disrupt continuity?"
      ],'unavailable'),
      category('YOUTH_PATHWAY','YOUTH PATHWAY',['pre','post'],'young',8,[
        "How important is a visible academy pathway to the identity of {club}?",
        "What tells you that a young player is ready for senior responsibility?",
        "Can development and immediate results genuinely be balanced at this level?",
        "Do senior players have a formal role in helping younger team-mates settle?",
        "How patient should supporters be with players learning at senior level?",
        "Would you risk short-term inconsistency to accelerate a major talent's development?"
      ],'young'),
      category('SUPPORTERS','SUPPORTERS',['pre','post'],'supporters',9,[
        "What message would you send to the {club} supporters before this match?",
        "How much can the atmosphere influence the team when momentum turns?",
        "Do you understand the frustration supporters show when performances fall short?",
        "What do you want the crowd to recognise in the way this team plays?",
        "Can the connection between the players and supporters become a competitive advantage?",
        "How important is it that supporters feel represented by the character of this squad?"
      ]),
      category('PRESSURE','MANAGER PRESSURE',['pre','post'],'self',10,[
        "How do you personally handle the pressure that comes with managing {club}?",
        "Do you feel greater scrutiny now than when you first took this job?",
        "What part of management is hardest to switch off from outside the training ground?",
        "Can a manager show vulnerability without weakening authority?",
        "When results are difficult, where do you find the certainty to keep making decisions?",
        "Do you ever enjoy the pressure, or is it simply something that has to be managed?"
      ]),
      category('PERSONAL_LIFE','LIFE AWAY FROM SPORT',['pre','post'],'personal',6,[
        "What helps you step away from the intensity of management when you leave the club?",
        "Has living in {world} changed the way you think about life away from the sport?",
        "How important is your support network during the most demanding parts of a season?",
        "Do you manage to protect any private time during a crowded fixture schedule?",
        "What have you learned about yourself since taking responsibility for {club}?",
        "Is there an interest outside the sport that makes you a better manager?"
      ]),
      category('CLUB_CULTURE','CLUB CULTURE',['pre','post'],'culture',8,[
        "What values do you want people to associate with {club} under your management?",
        "How do you turn standards written on a wall into habits players actually follow?",
        "Is the culture of this club strong enough to survive a difficult run of results?",
        "What behaviour would make you proud even if it never appeared in a match report?",
        "How much should new signings adapt to the club, and how much should the club adapt to them?",
        "Who protects the dressing-room culture when the coaching staff are not present?"
      ]),
      category('COMPETITION','THE COMPETITION',['pre','post'],'competition',8,[
        "How do you assess the overall standard of {competition} this season?",
        "Has any team in this competition surprised you with its progress?",
        "Do the current standings tell the truth about the strongest sides?",
        "What separates the leading teams from the rest of the competition?",
        "Is this season becoming more tactically demanding than you expected?",
        "Where must {club} improve to compete consistently with the best sides?"
      ]),
      category('CURRENT_STORY','AROUND THE CLUB',['pre','post'],'story',7,[
        "There has been plenty happening around {club} this week. Has it affected match preparation?",
        "How do you decide which outside stories deserve a response and which should be ignored?",
        "Do players pay more attention to public discussion than managers sometimes admit?",
        "Can a busy week away from the pitch bring a squad closer together?",
        "How do you stop speculation from becoming the dominant story around the team?",
        "Is there anything about the current public conversation that you believe has been misunderstood?"
      ])
    ],
    tones:{
      supportive:{label:'BACK YOUR PEOPLE',stance:'SUPPORTIVE'},
      accountable:{label:'TAKE RESPONSIBILITY',stance:'MEASURED'},
      demanding:{label:'SET THE STANDARD',stance:'ASSERTIVE'},
      guarded:{label:'PROTECT THE GROUP',stance:'GUARDED'}
    }
  };

  library.categories.push(
    category('PLAYER_OF_MATCH','PLAYER OF THE MATCH',['post'],'potm',14,[
      "{player} was named player of the match. What pleased you most about their performance?",
      "Was that the most complete display you have seen from {player} under your management?",
      "How do you make sure the praise around {player} strengthens rather than distracts them?",
      "Did {player} deliver exactly what your tactical plan required today?",
      "What does a performance like that tell you about {player}'s ceiling?",
      "How important was {player}'s personality when the match became difficult?"
    ],'potm'),
    category('GOAL_SCORER','DECISIVE PLAYER',['post'],'scorer',13,[
      "{player} made the decisive contribution. Was that something you worked on during the week?",
      "What did you see in {player}'s movement before the goal that the opposition failed to read?",
      "How much confidence will {player} take from scoring in this fixture?",
      "Do goals change the way the public evaluates everything else {player} contributes?",
      "Was {player} always your most likely match-winner today?",
      "Could that moment become a turning point in {player}'s season?"
    ],'scorer'),
    category('OPPONENT_PLAYER','OPPOSITION DANGER',['pre','post'],'opponentPlayer',10,[
      "How much of your preparation has been shaped by the threat of {opponentPlayer}?",
      "Would you describe {opponentPlayer} as the player your squad must stop first?",
      "Is there a risk that focusing on {opponentPlayer} creates space for somebody else?",
      "What quality in {opponentPlayer}'s game do you most admire?",
      "Could any player in your squad perform the role {opponentPlayer} gives {opponent}?",
      "Have you designed a specific matchup to limit {opponentPlayer}'s influence?"
    ]),
    category('TABLE_POSITION','LEAGUE POSITION',['pre','post'],'position',11,[
      "You currently sit {position}. Is that an honest reflection of where {club} are?",
      "How much attention should the players pay to the table at this point of the season?",
      "Does the current position create freedom for your team, or greater pressure?",
      "What would meaningful progress in the table look like over the next month?",
      "Are you ahead of schedule, behind it, or exactly where you expected to be?",
      "How do you stop the standings from influencing decisions that should be made on performance?"
    ],'position'),
    category('DISCIPLINE','DISCIPLINE',['post'],'squad',11,[
      "Discipline became part of the story today. Did your players lose emotional control?",
      "Were the cards a consequence of commitment, frustration, or poor decision-making?",
      "Do you believe the officials managed the temperature of the match effectively?",
      "Will you speak privately to the players involved in today's disciplinary incidents?",
      "Did the opposition deliberately try to provoke a reaction from your team?",
      "How concerned are you that discipline could affect selection in the next fixture?"
    ],'discipline'),
    category('OFFICIATING','THE OFFICIALS',['post'],'result',7,[
      "Were you satisfied with the major decisions made by the officials today?",
      "There was frustration on your bench at several moments. What was behind it?",
      "Do managers receive enough clarity from officials during high-pressure matches?",
      "Did any decision materially change the way you had to manage the game?",
      "How difficult is it to discuss officiating honestly without creating an unnecessary headline?",
      "Would you welcome the chance to hear the officials explain the most debated moment?"
    ]),
    category('ROTATION','ROTATION AND DEPTH',['pre','post'],'player',10,[
      "You have changed the team again. Is that rotation, a tactical choice, or a message to the squad?",
      "How do you keep players outside the starting group convinced that their opportunity is coming?",
      "Are you protecting freshness now because of the schedule ahead?",
      "Does this squad have enough depth to rotate without lowering the level?",
      "How much continuity do you sacrifice when you reward training form?",
      "Could today's selection surprise become a longer-term change?"
    ],'selection'),
    category('FATIGUE','FITNESS AND SCHEDULE',['pre','post'],'squad',9,[
      "Is fatigue beginning to influence the decisions you make with this team?",
      "How do you balance recovery with the need to prepare properly for {opponent}?",
      "Would you support changes to a schedule that asks this much of the players?",
      "Can mental fatigue be a bigger danger than physical tiredness at this stage?",
      "Are there players you are having to protect from their own desire to play every match?",
      "Does the schedule favour clubs with deeper resources?"
    ]),
    category('TRAINING_WEEK','THE TRAINING GROUND',['pre'],'player',9,[
      "Who changed your thinking most with their work in training this week?",
      "Was there a moment in training when you knew the squad were ready for {opponent}?",
      "How much can supporters learn from a team sheet about what happened away from the cameras?",
      "Have you changed the intensity of training because of recent results?",
      "What did {player} show during the week to earn your confidence?",
      "Was the focus this week tactical detail, physical sharpness, or mentality?"
    ]),
    category('TACTICAL_CHANGE','TACTICAL ADJUSTMENT',['post'],'tactics',12,[
      "You changed the shape during the match. What problem were you trying to solve?",
      "Did your players recognise the tactical adjustment quickly enough?",
      "Was the decisive change planned in advance or driven entirely by what you saw?",
      "How satisfied were you with the team's ability to adapt without losing control?",
      "Did {opponent} force you away from your preferred way of playing?",
      "Would you make the same tactical decision if you could play the match again?"
    ]),
    category('RIVALRY_FIXTURE','RIVALRY',['pre','post'],'opponent',12,[
      "Can a manager genuinely treat a meeting with {opponent} like any other fixture?",
      "How much does this rivalry mean to the people inside your dressing room?",
      "Do emotions around this fixture help your players or threaten the tactical plan?",
      "What does victory over {opponent} mean beyond the points or progression?",
      "Have you spoken to newer players about the history attached to this match?",
      "Is respect possible when the rivalry becomes this intense?"
    ]),
    category('SOCIAL_MEDIA','PUBLIC CONVERSATION',['pre','post'],'personal',6,[
      "Do you pay attention to the way supporters discuss your decisions online?",
      "Has social media made it harder for managers to protect young players from criticism?",
      "Can online reaction distort how a performance actually felt inside the stadium?",
      "Do you ever learn anything useful from supporter analysis outside the club?",
      "How do you stop a viral moment from becoming a distraction for the squad?",
      "Would you ever answer a supporter directly when criticism becomes personal?"
    ]),
    category('MANAGER_PHILOSOPHY','YOUR PHILOSOPHY',['pre','post'],'self',8,[
      "What is the one principle you will never compromise as manager of {club}?",
      "Has this squad changed your original idea of how you wanted the team to play?",
      "Do you want to be remembered more for results, style, or the people you develop?",
      "When does tactical flexibility become a loss of identity?",
      "Which part of your management has evolved most since taking this role?",
      "Can a clear philosophy survive a run when results turn against it?"
    ]),
    category('CLUB_AMBITION','CLUB AMBITION',['pre','post'],'board',9,[
      "Is {club} currently matching the ambition you were promised when you took the job?",
      "What must change off the pitch for this club to take the next step on it?",
      "Are supporters entitled to expect this team to challenge immediately?",
      "How much patience does a genuine long-term project deserve?",
      "Would you tell the board if their public ambition exceeded the resources available?",
      "What would make this season a success beyond the final league position?"
    ]),
    category('TRANSFER_RUMOUR','TRANSFER SPECULATION',['pre','post'],'transfer',9,[
      "Reports have linked {player} with a move. Can you clarify the club's position?",
      "Has transfer speculation changed the way {player} has trained this week?",
      "Can a player remain fully focused when their future is discussed every day?",
      "Would you rather settle {player}'s situation quickly or wait for the right outcome?",
      "Have other clubs shown the respect you expect when discussing your player?",
      "Is there any point at which every player has a price?"
    ],'transfer'),
    category('STAFF_ROLE','YOUR STAFF',['pre','post'],'staff',6,[
      "How important has your staff's work been in preparing the detail for this fixture?",
      "Who challenges your thinking most strongly inside the coaching team?",
      "Do you encourage disagreement among staff before a major decision?",
      "How much of what supporters see on matchday begins with work they never see?",
      "Has anyone on your staff taken on greater responsibility during this run?",
      "What separates a useful assistant from someone who simply agrees with the manager?"
    ]),
    category('DEFEAT_RESPONSE','AFTER DEFEAT',['post'],'squad',15,[
      "How do you lift the squad after a defeat that will hurt this much?",
      "Is this a result to analyse deeply or one the players must leave behind quickly?",
      "Did you learn anything today that forces you to reconsider your plan?",
      "Who needs to take responsibility for the way the match moved away from {club}?",
      "Are you more disappointed by the result or by the response when the team went behind?",
      "What must supporters see next to believe this was only a setback?"
    ],'defeat'),
    category('VICTORY_MOMENT','AFTER VICTORY',['post'],'squad',14,[
      "How much should your players enjoy this victory before attention turns to the next match?",
      "Was this the performance that best represents what you want {club} to become?",
      "What did the team show today that cannot be captured by the scoreline?",
      "Can a result like this change what the squad believe is possible?",
      "How do you celebrate properly without allowing standards to soften?",
      "Did you sense before kickoff that the group were ready to produce something special?"
    ],'victory')
  );

  const answer=(id,label,text,effects={},expression='expression_01',stance='ON RECORD')=>({id,label,text,effects,expression,stance});
  library.answerBanks={
    PLAYER_FORM:[
      answer('form-earned','THE FORM IS REAL','{player} is affecting matches. That is why the attention is there. The next test is doing it again.',{targetMorale:1,targetTrust:1,reporter:1,tone:'respectful'},'expression_02','BACKING THE PLAYER'),
      answer('form-more','THERE IS MORE TO COME','The numbers are good. {player} will tell you there are parts of the game that still need work.',{targetTest:'professionalism',board:1,reporter:1},'expression_03','SETTING A CHALLENGE'),
      answer('form-team','LOOK AT THE TEAM','{player} has played well because the team has put them in good positions. I will not turn one player into the whole story.',{squadMorale:1,squadCount:3,reporter:-1},'expression_01','SHARING THE CREDIT'),
      answer('form-private','I TELL HIM IN PRIVATE','He knows exactly what I think of his form. Praise and criticism mean more when they are said to the player first.',{targetTrust:2,reporter:-2},'expression_11','KEEPING IT PRIVATE'),
      answer('form-bench','FORM DOES NOT GUARANTEE A PLACE','He has earned the shirt today. He still has to earn it again next week.',{targetTest:'ambition',squadMorale:1,squadCount:2,reporter:1},'expression_03','KEEPING PLACES OPEN')
    ],
    SELECTION:[
      answer('selection-training','HE TRAINED HIS WAY IN','{player} was excellent in training. The team sheet should reflect what happens all week, not only what happened last match.',{targetMorale:1,targetTrust:2,squadMorale:1,squadCount:2,reporter:1},'expression_02','REWARDING TRAINING'),
      answer('selection-tactical','THIS ONE IS TACTICAL','We need {player} for a specific job against {opponent}. It is a decision for this match, not a ranking of the squad.',{targetTrust:1,reporter:2,tone:'analytical'},'expression_01','EXPLAINING THE PLAN'),
      answer('selection-reaction','I WANT A REACTION','{player} has not been at his best. Starting today is a challenge, not a reward.',{targetTest:'professionalism',board:1,reporter:1,tone:'provocative'},'expression_03','PUBLIC CHALLENGE'),
      answer('selection-no-guarantees','NOBODY OWNS THE SHIRT','Reputation did not pick this team. The players who are ready for {opponent} are playing.',{squadMorale:1,squadCount:3,reporter:1,headline:true},'expression_09','OPEN COMPETITION'),
      answer('selection-private','THE PLAYER KNOWS WHY','I spoke to {player} before the team was announced. I will not repeat a private selection conversation in here.',{targetTrust:2,reporter:-2},'expression_11','NO PUBLIC DETAIL')
    ],
    CAPTAINCY:[
      answer('captain-standard','HE SETS THE LINE','{captain} knows the standards I expect. The important part is enforcing them when no coach is in the room.',{targetMorale:1,targetTrust:2,board:1},'expression_02','BACKING THE CAPTAIN'),
      answer('captain-challenge','THE ARMBAND IS NOT PROTECTION','Captain or not, {captain} is judged on performance. Leadership cannot become immunity.',{targetTest:'professionalism',squadMorale:1,squadCount:2,reporter:1},'expression_03','CHALLENGING THE CAPTAIN'),
      answer('captain-voice','I EXPECT HIM TO DISAGREE','I do not need {captain} to agree with every decision. I need an honest voice who speaks at the right time.',{targetTrust:3,reporter:2},'expression_07','INVITING LEADERSHIP'),
      answer('captain-group','LEADERSHIP IS BIGGER THAN ONE PLAYER','The armband matters. So do the other senior voices. This cannot become one person’s dressing room.',{squadMorale:1,squadCount:3,targetTrust:-1},'expression_01','SHARING AUTHORITY')
    ],
    BREAKTHROUGH:[
      answer('breakthrough-ready','HE IS READY TO BE HERE','{player} is young. He is also here on merit. I will not lower the expectation because of his age.',{targetMorale:1,targetTrust:2,reputation:1,headline:true},'expression_09','BACKING THE PROSPECT'),
      answer('breakthrough-patient','DO NOT RUSH THE STORY','He has taken a good step. Turning that into a verdict on his whole career would not help him.',{targetTrust:2,reporter:-1,tone:'respectful'},'expression_01','PROTECTING DEVELOPMENT'),
      answer('breakthrough-next','NOW HE HAS TO KEEP HIS PLACE','The first appearance gets attention. The hard part for {player} is being ready when the excitement has gone.',{targetTest:'ambition',board:1},'expression_03','RAISING THE TEST'),
      answer('breakthrough-path','THE PATHWAY HAS TO BE REAL','Young players notice whether chances are genuine. {player} has shown the next one can earn a place too.',{squadMorale:1,squadCount:3,reputation:1,reporter:1},'expression_02','BACKING THE ACADEMY')
    ],
    SQUAD_MOOD:[
      answer('mood-strong','THE ROOM IS STRONG','There are hard conversations. There should be. The important thing is that the group leaves them pulling in the same direction.',{squadMorale:1,squadCount:4,reporter:1},'expression_02','CONFIDENT IN THE GROUP'),
      answer('mood-friction','IT IS NOT ALL COMFORTABLE','Players want to play. Some are unhappy. I would worry more if nobody cared enough to challenge me.',{squadMorale:-1,squadCount:2,board:1,reporter:2,headline:true},'expression_07','ADMITTING TENSION'),
      answer('mood-results','RESULTS WILL TELL YOU','I can describe the mood any way I like. What the players do against {opponent} is the honest answer.',{reporter:-1,board:1},'expression_11','DEFLECTING TO THE MATCH'),
      answer('mood-work','THE WEEK HAS BEEN SERIOUS','The noise outside has not changed the work. Training was sharp and the team is ready.',{squadMorale:1,squadCount:3,targetTrust:1},'expression_01','FOCUSING ON WORK')
    ],
    RECENT_FORM:[
      answer('run-performance','THE RESULTS HIDE SOME PROGRESS','The run is {form}. I have seen parts of our game improve. We now need that work to decide results.',{squadMorale:1,squadCount:2,reporter:1,tone:'analytical'},'expression_01','DEFENDING THE PROCESS'),
      answer('run-not-enough','THE RETURN IS NOT GOOD ENOUGH','There is no point dressing up {form}. We need more points and the players know it.',{squadTest:'professionalism',board:1,reporter:2,headline:true},'expression_03','DEMANDING RESULTS'),
      answer('run-own','I HAVE TO CHANGE IT','The decisions are mine. If the run continues, I am the first person who has to find a better answer.',{board:2,reputation:1,squadMorale:1,squadCount:2,reporter:2},'expression_07','TAKING RESPONSIBILITY'),
      answer('run-next','ONLY THE NEXT MATCH MATTERS','We have reviewed the run. I am not carrying all five results onto the pitch against {opponent}.',{reporter:-1,squadMorale:1,squadCount:3},'expression_11','CLOSING THE RUN')
    ],
    MATCH_RESULT:[
      answer('result-fair','THE SCORE WAS FAIR','At {score}, there is no need to invent another match. The better side in the decisive moments got the result.',{reporter:2,board:1,tone:'analytical'},'expression_01','ACCEPTING THE RESULT'),
      answer('result-details','WE LOST IT IN THE DETAILS','The margin looks simple. The match was decided by moments we had prepared for and did not execute.',{squadTest:'professionalism',reporter:2,board:1},'expression_03','FOCUSING ON EXECUTION'),
      answer('result-manager','THAT RESULT IS ON ME','I picked the team and set the plan. The players should not carry my decisions for me.',{squadMorale:1,squadCount:3,board:1,reputation:1,reporter:2},'expression_07','OWNING THE RESULT'),
      answer('result-unfair','THE SCORE DOES NOT TELL THE MATCH','Anyone who watched the full game saw more than {score}. We were not as far away as that result suggests.',{squadMorale:1,squadCount:2,reporter:-1,headline:true},'expression_09','DISPUTING THE VERDICT'),
      answer('result-no-review','I WILL REVIEW IT FIRST','I have an immediate reaction. I would rather give the players a proper analysis than perform one for the cameras.',{targetTrust:1,squadMorale:1,squadCount:2,reporter:-2},'expression_11','RESERVING JUDGEMENT')
    ],
    TACTICS:[
      answer('tactics-space','WE ARE ATTACKING A SPECIFIC SPACE','{opponent} leave an area we believe we can reach. The shape is designed to get our strongest players there.',{reporter:2,tone:'analytical',headline:true},'expression_01','REVEALING THE IDEA'),
      answer('tactics-us','WE WILL PLAY OUR GAME','I respect {opponent}. I am not rebuilding our identity for one opponent.',{squadMorale:1,squadCount:3,reputation:1,reporter:1},'expression_09','TRUSTING THE IDENTITY'),
      answer('tactics-adapt','THE PLAYERS HAVE TWO PLANS','We know how we want to start. If the match changes, the players know the second answer as well.',{board:1,reporter:2,tone:'analytical'},'expression_02','SHOWING FLEXIBILITY'),
      answer('tactics-private','I AM NOT GIVING THEM THE PLAN','{opponent} can wait for the first whistle like everyone else. I will not coach their team from this desk.',{reporter:-2,rivalHeat:2,headline:true},'expression_11','HIDING THE PLAN'),
      answer('tactics-risk','WE ARE TAKING A RISK','There is a trade-off in the plan. We accept it because being passive would be the greater risk.',{squadMorale:1,squadCount:2,board:1,reporter:2,headline:true},'expression_09','ACCEPTING THE GAMBLE')
    ],
    OPPONENT:[
      answer('opp-respect','THEY DESERVE RESPECT','{opponent} are organised and dangerous. If we are even slightly below our level, they will punish us.',{rivalRespect:2,reporter:1,tone:'respectful'},'expression_01','RESPECTING THE OPPOSITION'),
      answer('opp-weakness','THEY CAN BE HURT','They have strengths. They also leave chances. We have not come here only to contain them.',{squadMorale:1,squadCount:3,rivalHeat:3,headline:true},'expression_09','BACKING YOUR THREAT'),
      answer('opp-player','ONE PLAYER WILL NOT DECIDE IT','We know their key threats. The mistake would be forgetting everything else {opponent} can do.',{reporter:1,tone:'analytical'},'expression_01','WIDENING THE FOCUS'),
      answer('opp-none','ASK ME AFTER THE MATCH','I will tell you how difficult they were when we have played them. Beforehand, it is only talk.',{reporter:-2,rivalHeat:1},'expression_11','REFUSING THE PREVIEW')
    ],
    RIVAL_MANAGER:[
      answer('rival-respect','I RESPECT HIS WORK','{rivalManager} has built a clear team. Respect does not mean I want him to enjoy this match.',{rivalRespect:4,rivalHeat:-2,reporter:1},'expression_02','PROFESSIONAL RESPECT'),
      answer('rival-no-friendship','WE ARE NOT HERE TO BE FRIENDS','Our relationship is competitive. That is enough. I care about beating {opponent}.',{rivalHeat:5,rivalRespect:-1,reporter:2,headline:true},'expression_03','DRAWING THE LINE'),
      answer('rival-better','I BELIEVE I HAVE THE BETTER SIDE','He will back his team. I will back mine. Today I believe ours has more answers.',{squadMorale:1,squadCount:3,rivalHeat:7,rivalRespect:-2,reputation:1,headline:true},'expression_09','PUBLIC CHALLENGE'),
      answer('rival-tactical','THE CONTEST IS TACTICAL','The relationship is not the story for me. The decisions each manager makes during the match are.',{rivalRespect:1,reporter:-1,tone:'analytical'},'expression_01','KEEPING IT TECHNICAL'),
      answer('rival-dismiss','I DO NOT THINK ABOUT HIM','I prepare for {opponent}. I do not spend the week thinking about the person in the other dugout.',{rivalHeat:4,rivalRespect:-3,reporter:1,headline:true},'expression_11','DISMISSING THE RIVALRY')
    ],
    BOARD:[
      answer('board-aligned','WE AGREE ON THE DIRECTION','The board know what we are building and what it will take. There are no mixed messages inside the club.',{board:2,reporter:1},'expression_02','SHOWING UNITY'),
      answer('board-football','THE TEAM COMES FIRST','Targets matter. They do not pick the line-up or change the work we believe this team needs.',{board:-1,reputation:1,reporter:2,headline:true},'expression_09','ASSERTING CONTROL'),
      answer('board-resources','AMBITION NEEDS SUPPORT','The objectives are clear. To reach them, the football side must receive the support we discussed.',{board:-2,reporter:2,headline:true,callback:'BOARD_SUPPORT'},'expression_03','PRESSURING THE BOARD'),
      answer('board-private','THOSE TALKS STAY PRIVATE','The board hear my honest view. I will not negotiate the club’s direction through a press conference.',{board:1,reporter:-2},'expression_11','KEEPING TALKS PRIVATE')
    ],
    TRANSFERS:[
      answer('transfers-ready','WE WILL ACT IF IT IMPROVES US','We are not collecting names. If the right player makes the team better, the club is ready to move.',{board:1,reporter:2,headline:true,callback:'TRANSFER_INTENT'},'expression_09','SIGNALLING INTENT'),
      answer('transfers-content','I TRUST THIS SQUAD','I will not ask these players to prepare for {opponent} while talking as though replacements are the answer.',{squadMorale:1,squadCount:4,reporter:-1},'expression_02','BACKING THE SQUAD'),
      answer('transfers-gap','WE STILL HAVE A GAP','There is one area where we are short. The recruitment team know it and the work is active.',{board:-1,reporter:3,headline:true,callback:'SQUAD_GAP'},'expression_03','ADMITTING A NEED'),
      answer('transfers-youth','THE ANSWER MAY ALREADY BE HERE','Before we block a pathway, we will look at the young players who have earned a chance.',{squadMorale:1,squadCount:2,reputation:1,reporter:1},'expression_01','PROTECTING THE PATHWAY'),
      answer('transfers-none','I WILL NOT DISCUSS TARGETS','Names in public make deals harder and treat players badly. We will speak when something is complete.',{board:1,reporter:-3},'expression_11','NO RUNNING COMMENTARY')
    ],
    CONTRACTS:[
      answer('contract-wanted','WE WANT HIM TO STAY','{player} knows how highly we value him. I hope the agreement reflects that soon.',{targetMorale:1,targetTrust:2,reporter:2,headline:true,callback:'CONTRACT_CONFIDENCE'},'expression_02','PUBLIC BACKING'),
      answer('contract-earn','A CONTRACT HAS TO BE EARNED','The name does not decide the deal. Performance and the future role have to make sense for both sides.',{targetTest:'ambition',board:1,reporter:1},'expression_03','SETTING TERMS'),
      answer('contract-playing','HE IS AVAILABLE TO PLAY','The contract is not picking the team. If {player} is the right player for the match, he will play.',{targetTrust:1,reporter:1},'expression_01','SEPARATING FOOTBALL'),
      answer('contract-private','NEGOTIATIONS ARE PRIVATE','Both sides are talking. Running each conversation through this room would make an agreement less likely.',{targetTrust:1,reporter:-2},'expression_11','PROTECTING NEGOTIATIONS')
    ],
    AVAILABILITY:[
      answer('absence-miss','OF COURSE WE MISS HIM','{player} gives us qualities nobody else copies exactly. The team has to solve the absence together.',{targetMorale:1,targetTrust:2,squadMorale:1,squadCount:2,reporter:1},'expression_07','ACKNOWLEDGING THE LOSS'),
      answer('absence-depth','THIS IS WHY WE HAVE A SQUAD','One player is unavailable. Another has earned the chance to show why they are here.',{squadMorale:1,squadCount:3,reporter:1},'expression_02','BACKING THE DEPTH'),
      answer('absence-change','THE PLAN HAS CHANGED','We cannot pretend the same solution works without {player}. We have adjusted the way we will play.',{reporter:2,tone:'analytical'},'expression_01','CONFIRMING AN ADJUSTMENT'),
      answer('absence-medical','I WILL NOT GUESS ON A RETURN','The medical team will decide when {player} is ready. A press-conference date will not speed that up.',{targetTrust:2,reporter:-2},'expression_11','PROTECTING RECOVERY')
    ],
    YOUTH_PATHWAY:[
      answer('youth-merit','THE DOOR IS OPEN','Age will not keep a player out. It will not put a player in either. The level decides.',{squadMorale:1,squadCount:3,reputation:1,reporter:1},'expression_02','MERIT-BASED PATHWAY'),
      answer('youth-risk','DEVELOPMENT NEEDS MINUTES','Young players will make mistakes. If we only use them when there is no risk, the pathway is not real.',{targetMorale:1,targetTrust:2,board:-1,reputation:1,headline:true},'expression_09','ACCEPTING THE RISK'),
      answer('youth-patient','NOT EVERY STEP IS PUBLIC','A good month does not mean a young player needs a major role tomorrow. Patience is part of development.',{targetTrust:1,reporter:-1},'expression_01','SLOWING THE HYPE'),
      answer('youth-senior','SENIOR PLAYERS MATTER TOO','A pathway works because experienced players set the level. This is not youth against experience.',{squadMorale:1,squadCount:4,reporter:1},'expression_07','BALANCING THE SQUAD')
    ],
    SUPPORTERS:[
      answer('fans-need','WE NEED THEIR NOISE','There will be a moment when {opponent} have control. That is when the players need the crowd most.',{squadMorale:1,squadCount:3,reputation:1,reporter:1},'expression_02','CALLING ON THE CROWD'),
      answer('fans-owe','WE OWE THEM A PERFORMANCE','Supporters can accept a difficult match. They should not have to accept a team that does not represent them.',{squadTest:'professionalism',board:1,reporter:2,headline:true},'expression_03','PROMISING A STANDARD'),
      answer('fans-frustration','THE FRUSTRATION IS FAIR','They pay, travel and care. If the performances fall short, they are entitled to say so.',{reputation:1,reporter:2,squadMorale:-1,squadCount:2},'expression_07','ACCEPTING CRITICISM'),
      answer('fans-football','WE HAVE TO GIVE THEM SOMETHING','The connection cannot be demanded from a microphone. Our football has to create it.',{board:1,reporter:1},'expression_01','EARNING SUPPORT')
    ],
    PRESSURE:[
      answer('pressure-job','PRESSURE IS THE JOB','I wanted the responsibility. I cannot ask for the job and complain when the decisions are examined.',{board:1,reputation:1,reporter:2},'expression_01','ACCEPTING SCRUTINY'),
      answer('pressure-team','KEEP IT ON ME','If somebody needs to carry the pressure this week, it should be the manager. The players need clarity.',{squadMorale:1,squadCount:3,targetTrust:1,reporter:1},'expression_07','SHIELDING THE TEAM'),
      answer('pressure-noise','I DO NOT MANAGE THE NOISE','The pressure outside changes by the hour. The work inside the club cannot.',{reporter:-1,board:1},'expression_11','IGNORING THE NOISE'),
      answer('pressure-love','I LIKE THIS PART','Important matches should feel important. I would rather have this pressure than manage games nobody cares about.',{squadMorale:1,squadCount:3,reputation:1,reporter:2,headline:true},'expression_09','EMBRACING THE MOMENT')
    ],
    PERSONAL_LIFE:[
      answer('personal-boundary','THAT PART STAYS MINE','The job is public. My life away from it is not. I keep that boundary for a reason.',{reporter:-1},'expression_11','SETTING A BOUNDARY'),
      answer('personal-people','GOOD PEOPLE KEEP ME LEVEL','The people close to me tell me when football has taken over the whole room. I need that honesty.',{reporter:3,reputation:1},'expression_07','PERSONAL ANSWER'),
      answer('personal-work','THE WORK HELPS ME SWITCH OFF','I do not have a perfect routine. A clear plan for the next day is usually what lets me leave the day behind.',{reporter:2},'expression_01','HONEST REFLECTION'),
      answer('personal-city','THIS PLACE FEELS LIKE HOME','Living in {world} has changed the rhythm of my life. I understand the club better because I understand more of the place around it.',{reputation:1,reporter:2},'expression_02','CONNECTING LOCALLY')
    ],
    CLUB_CULTURE:[
      answer('culture-behaviour','WATCH WHAT WE ALLOW','Culture is not a slogan. It is the behaviour staff and players walk past without challenging.',{squadTest:'professionalism',board:1,reporter:2},'expression_03','ENFORCING BEHAVIOUR'),
      answer('culture-players','THE PLAYERS OWN IT','Coaches can set rules. The strongest culture is protected by the players when we are not there.',{squadMorale:1,squadCount:3,targetTrust:1},'expression_02','PLAYER OWNERSHIP'),
      answer('culture-results','IT HAS TO SURVIVE DEFEAT','Anyone can talk about values after a win. I learn about this club when the result hurts.',{board:1,reporter:1},'expression_01','TESTING THE CULTURE'),
      answer('culture-change','SOME HABITS HAVE TO CHANGE','Respecting the club does not mean preserving every old habit. We are here to improve it.',{board:-1,reputation:1,reporter:2,headline:true},'expression_09','CHANGING THE CLUB')
    ],
    COMPETITION:[
      answer('league-open','THE LEVEL IS CLOSER THAN PEOPLE THINK','There are no quiet weeks in {competition}. A small drop in performance changes the table quickly.',{reporter:1,tone:'analytical'},'expression_01','ASSESSING THE LEAGUE'),
      answer('league-target','WE WANT TO SET THE LEVEL','I am not interested in admiring the strongest teams. I want {club} to become one of them.',{squadMorale:1,squadCount:3,board:1,reputation:1,headline:true},'expression_09','DECLARING AMBITION'),
      answer('league-table','THE TABLE IS HONEST','After enough matches, the table stops lying. If we want a better place, we have to earn it.',{squadTest:'professionalism',board:1,reporter:1},'expression_03','ACCEPTING THE TABLE'),
      answer('league-early','IT IS TOO EARLY FOR VERDICTS','The competition will look different after another month. I will judge patterns, not one weekend.',{reporter:-1},'expression_11','RESERVING JUDGEMENT')
    ],
    CURRENT_STORY:[
      answer('story-no-impact','IT HAS NOT CHANGED THE WORK','The players know what is real and what is noise. Preparation for {opponent} has not moved.',{squadMorale:1,squadCount:2,reporter:-1},'expression_01','DISMISSING THE NOISE'),
      answer('story-wrong','PART OF THE STORY IS WRONG','People can discuss {story}. They should not treat speculation as something the club has confirmed.',{reporter:-2,headline:true},'expression_03','CHALLENGING THE COVERAGE'),
      answer('story-address','WE DEALT WITH IT DIRECTLY','The people involved have spoken inside the club. That matters more than another public exchange.',{targetTrust:1,squadMorale:1,squadCount:2,reporter:1},'expression_02','INTERNAL RESOLUTION'),
      answer('story-answer','THE MATCH CAN CHANGE THE STORY','We have a chance against {opponent} to give everyone something real to discuss.',{squadMorale:1,squadCount:3,reputation:1,reporter:2},'expression_09','TURNING TO THE MATCH')
    ],
    PLAYER_OF_MATCH:[
      answer('potm-complete','THAT WAS A COMPLETE PERFORMANCE','{player} influenced the match with and without the ball. The award recognises more than one highlight.',{targetMorale:1,targetTrust:2,reporter:2,headline:true},'expression_02','FULL PRAISE'),
      answer('potm-team','THE TEAM CREATED THAT DISPLAY','{player} was outstanding. He will be the first to recognise the work around him.',{targetMorale:1,squadMorale:1,squadCount:3,reporter:1},'expression_01','SHARING THE CREDIT'),
      answer('potm-standard','NOW THAT IS HIS STANDARD','The performance was excellent. The challenge is making that level normal.',{targetTest:'ambition',board:1,reporter:1},'expression_03','SETTING THE NEXT TEST'),
      answer('potm-plan','HE DELIVERED THE PLAN','We asked {player} to solve a specific problem. He understood it and executed it under pressure.',{targetTrust:2,reporter:2,tone:'analytical'},'expression_01','TACTICAL PRAISE')
    ],
    GOAL_SCORER:[
      answer('scorer-work','THE MOVEMENT WAS REHEARSED','That finish gets the replay. The movement before it came from work we did all week.',{targetMorale:1,targetTrust:2,reporter:2,tone:'analytical'},'expression_02','PRAISING THE DETAIL'),
      answer('scorer-instinct','YOU CANNOT COACH ALL OF THAT','The plan put {player} there. What he did next was instinct and quality.',{targetMorale:2,targetTrust:1,reporter:2,headline:true},'expression_07','PRAISING THE TALENT'),
      answer('scorer-more','ONE GOAL IS NOT THE TARGET','It was an important moment. {player} is capable of affecting more matches like this.',{targetTest:'ambition',reporter:1},'expression_03','DEMANDING CONSISTENCY'),
      answer('scorer-result','THE GOAL ONLY MATTERS WITH THE RESULT','I am pleased for him. The contribution belongs inside the team performance first.',{squadMorale:1,squadCount:3,targetMorale:1},'expression_01','TEAM BEFORE INDIVIDUAL')
    ],
    OPPONENT_PLAYER:[
      answer('oppstar-special','HE IS A SPECIAL PLAYER','We respect what {opponentPlayer} can do. Pretending otherwise would be poor preparation.',{rivalRespect:2,reporter:1},'expression_01','ACKNOWLEDGING THE THREAT'),
      answer('oppstar-system','STOPPING ONE PLAYER IS NOT ENOUGH','{opponentPlayer} gets the attention. The structure around him is what makes {opponent} dangerous.',{reporter:2,tone:'analytical'},'expression_01','READING THE SYSTEM'),
      answer('oppstar-duel','OUR PLAYER CAN WIN THAT DUEL','There will be a direct contest. I trust our player to make it difficult for him.',{squadMorale:1,squadCount:2,rivalHeat:2,headline:true},'expression_09','BACKING THE MATCHUP'),
      answer('oppstar-us','MAKE HIM DEFEND US','If we spend the whole match reacting to {opponentPlayer}, we have already given up too much.',{squadMorale:1,squadCount:3,reporter:1},'expression_03','TAKING THE INITIATIVE')
    ],
    TABLE_POSITION:[
      answer('table-honest','THE TABLE IS THE TABLE','We are {position}. That is what we have earned so far. Excuses do not add points.',{board:1,reporter:2},'expression_01','ACCEPTING THE POSITION'),
      answer('table-ceiling','IT IS NOT OUR CEILING','The position is real. It is not where I believe this group has to finish.',{squadMorale:1,squadCount:3,board:1,reputation:1,headline:true},'expression_09','AIMING HIGHER'),
      answer('table-process','I LOOK AT THE GAP','The number beside our name matters less than the points between us and where we want to be.',{reporter:2,tone:'analytical'},'expression_01','READING THE RACE'),
      answer('table-ignore','NOT IN THE DRESSING ROOM','The players know the table. They do not need me turning every team talk into a calculation.',{reporter:-1,squadMorale:1,squadCount:2},'expression_11','KEEPING THE FOCUS')
    ],
    DISCIPLINE:[
      answer('cards-ours','WE LOST OUR DISCIPLINE','Commitment is not an excuse for poor decisions. We made the match harder for ourselves.',{squadTest:'professionalism',board:1,reporter:2},'expression_03','CRITICISING CONTROL'),
      answer('cards-official','THE TEMPERATURE WAS NOT MANAGED','Both teams felt the line moving. Players need consistency if they are expected to stay calm.',{reporter:1,headline:true,board:-1},'expression_09','QUESTIONING CONTROL'),
      answer('cards-private','I WILL DEAL WITH THE PLAYERS','The incidents will be reviewed. The players involved will hear from me before you do.',{targetTrust:1,squadMorale:1,squadCount:2,reporter:-2},'expression_11','HANDLING IT INTERNALLY'),
      answer('cards-edge','I WILL NOT REMOVE OUR EDGE','We must make better decisions. I do not want a committed team becoming frightened of every challenge.',{squadMorale:1,squadCount:3,reporter:1},'expression_02','PROTECTING INTENSITY')
    ],
    OFFICIATING:[
      answer('ref-no-excuse','THE OFFICIAL DID NOT DECIDE EVERYTHING','There were decisions I disliked. We still had enough control over our own performance.',{board:1,reporter:2,squadTest:'professionalism'},'expression_01','REFUSING THE EXCUSE'),
      answer('ref-cost','ONE DECISION CHANGED THE MATCH','I have watched the moment back. It was a major decision and it hurt us.',{headline:true,reporter:3,board:-1,callback:'OFFICIATING'},'expression_09','CALLING OUT THE DECISION'),
      answer('ref-clarity','WE NEED AN EXPLANATION','I am not asking for special treatment. I am asking for a clear explanation of what the official saw.',{reporter:2,reputation:1,callback:'OFFICIATING'},'expression_03','REQUESTING CLARITY'),
      answer('ref-fine','THE OFFICIAL HAD A DIFFICULT MATCH','The game moved quickly and the major calls were consistent. I have no complaint.',{reporter:1,rivalRespect:1},'expression_02','ACCEPTING THE OFFICIATING'),
      answer('ref-private','I WILL SEND THE REPORT','There is a process for our concerns. I will use it instead of risking a fine for a headline.',{board:1,reporter:-2},'expression_11','USING THE PROCESS')
    ],
    ROTATION:[
      answer('rotation-fresh','THE SCHEDULE FORCED A DECISION','Some players needed protection. Freshness today is part of keeping the squad available next week.',{squadMorale:1,squadCount:2,reporter:2},'expression_01','MANAGING THE LOAD'),
      answer('rotation-earned','THE CHANGES WERE EARNED','The players coming in trained well. Rotation is not a gift when the place has been won.',{targetMorale:1,targetTrust:2,squadMorale:1,squadCount:2},'expression_02','REWARDING THE SQUAD'),
      answer('rotation-message','YES, IT IS A MESSAGE','A place has to remain competitive. If the level drops, somebody else gets the opportunity.',{squadTest:'professionalism',board:1,headline:true},'expression_03','CHALLENGING THE XI'),
      answer('rotation-tactical','IT IS ABOUT THIS MATCH','Different opponents demand different qualities. Do not read a permanent hierarchy into one team sheet.',{targetTrust:1,reporter:2,tone:'analytical'},'expression_01','TACTICAL ROTATION')
    ],
    FATIGUE:[
      answer('fatigue-real','THE LOAD IS REAL','The data and the players are telling us the same thing. Ignoring fatigue would be negligence.',{targetTrust:1,squadMorale:1,squadCount:2,reporter:2},'expression_01','ACKNOWLEDGING FATIGUE'),
      answer('fatigue-ready','NO EXCUSES TODAY','The schedule is hard for everyone. The selected players are ready to perform.',{squadTest:'professionalism',board:1,reporter:1},'expression_03','REJECTING EXCUSES'),
      answer('fatigue-depth','THE SQUAD HAS TO CARRY IT','This is where players outside the usual line-up become important. We trust them.',{squadMorale:1,squadCount:4,reporter:1},'expression_02','USING THE DEPTH'),
      answer('fatigue-calendar','THE SCHEDULE SHOULD BE EXAMINED','Player welfare cannot become a slogan while recovery time keeps shrinking.',{reputation:1,reporter:2,headline:true},'expression_09','CHALLENGING THE SCHEDULE')
    ],
    TRAINING_WEEK:[
      answer('training-name','{player} CHANGED MY THINKING','{player} forced the decision with his work this week. Managers should notice when a player makes the plan harder to ignore.',{targetMorale:1,targetTrust:2,reporter:2,headline:true},'expression_02','NAMING THE PLAYER'),
      answer('training-sharp','THE WHOLE GROUP WAS SHARP','The intensity was good from the first session. Nobody trained as though the team was already decided.',{squadMorale:1,squadCount:4,reporter:1},'expression_02','PRAISING THE WEEK'),
      answer('training-change','WE CHANGED THE LOAD','The last performance told us the work needed to change. This week was shorter and more specific.',{reporter:2,tone:'analytical',board:1},'expression_01','EXPLAINING THE ADJUSTMENT'),
      answer('training-private','THE DETAIL STAYS ON THE GRASS','I can tell you the week was productive. The useful tactical detail belongs to the players.',{reporter:-2},'expression_11','KEEPING THE DETAIL')
    ],
    TACTICAL_CHANGE:[
      answer('change-planned','WE HAD REHEARSED IT','The match reached the trigger we had discussed. The players recognised it and changed without panic.',{reporter:2,board:1,tone:'analytical'},'expression_02','PLANNED ADJUSTMENT'),
      answer('change-fix','THE FIRST PLAN WAS NOT WORKING','I could protect my original idea or help the team. The change was needed.',{board:1,reputation:1,reporter:2},'expression_07','ADMITTING THE ERROR'),
      answer('change-players','THE PLAYERS SOLVED IT','The message from the side was small. The players read the spaces and made the adjustment work.',{squadMorale:1,squadCount:3,targetTrust:1,reporter:1},'expression_02','CREDITING THE TEAM'),
      answer('change-opponent','THEY FORCED THE CHANGE','{opponent} created a problem. Respecting that quickly is management, not surrender.',{rivalRespect:2,reporter:2},'expression_01','CREDITING THE OPPOSITION')
    ],
    RIVALRY_FIXTURE:[
      answer('derby-feel','THIS ONE IS DIFFERENT','The points count the same. The week does not feel the same and the players understand why.',{squadMorale:1,squadCount:3,rivalHeat:3,reporter:2},'expression_07','EMBRACING THE RIVALRY'),
      answer('derby-control','EMOTION CANNOT DRIVE THE PLAN','We can use the atmosphere. We cannot let it choose our decisions for us.',{board:1,reporter:2,tone:'analytical'},'expression_01','CONTROLLING THE OCCASION'),
      answer('derby-win','THEY KNOW WHAT VICTORY MEANS','I do not need to manufacture motivation for {opponent}. The responsibility is performing with it.',{squadTest:'professionalism',rivalHeat:4,headline:true},'expression_03','DEMANDING A DERBY DISPLAY'),
      answer('derby-respect','RIVALRY STILL NEEDS RESPECT','Intensity is part of the fixture. Losing discipline would betray what the match deserves.',{rivalRespect:3,rivalHeat:-1,reporter:1},'expression_02','RESPECTING THE OCCASION')
    ],
    SOCIAL_MEDIA:[
      answer('social-ignore','I DO NOT PICK TEAMS ONLINE','Supporters can debate every decision. The team sheet still comes from the work we see at the club.',{reporter:-1,board:1},'expression_11','IGNORING ONLINE NOISE'),
      answer('social-listen','SOME CRITICISM IS FAIR','The volume does not make an opinion right. That does not mean we should refuse to listen.',{reputation:1,reporter:2},'expression_07','LISTENING WITHOUT FOLLOWING'),
      answer('social-players','PLAYERS SHOULD NOT HAVE TO ABSORB IT ALL','Criticism of performance is part of the game. Personal abuse is not.',{targetTrust:2,squadMorale:1,squadCount:3,reputation:1,headline:true},'expression_03','DEFENDING THE PLAYERS'),
      answer('social-answer','THE BEST RESPONSE IS A PERFORMANCE','We can spend the week replying or give people a better conversation after {opponent}.',{squadMorale:1,squadCount:2,reporter:1},'expression_09','ANSWERING ON THE PITCH')
    ],
    MANAGER_PHILOSOPHY:[
      answer('philosophy-core','THE PRINCIPLES STAY','The results can force adjustments. They should not make the team forget what it is trying to become.',{squadMorale:1,squadCount:3,board:1,reputation:1},'expression_02','HOLDING THE IDENTITY'),
      answer('philosophy-adapt','PRINCIPLES ARE NOT A PRISON','A manager who never adapts is asking players to solve his pride. We will change when the match demands it.',{board:1,reporter:2,tone:'analytical'},'expression_01','PRAGMATIC ADAPTATION'),
      answer('philosophy-win','WINNING IS PART OF THE IDEA','Style without results is not enough here. The way we play has to help us win.',{squadTest:'ambition',board:1,reporter:2},'expression_03','RESULTS WITH IDENTITY'),
      answer('philosophy-time','JUDGE IT OVER A SEASON','One match can make any idea look perfect or foolish. The body of work is the fair test.',{reporter:-1},'expression_11','ASKING FOR TIME')
    ],
    CLUB_AMBITION:[
      answer('ambition-now','WE SHOULD COMPETE NOW','The badge and the squad give us no reason to think small. We should be in the important matches.',{squadMorale:1,squadCount:3,board:1,reputation:1,headline:true,callback:'AMBITION'},'expression_09','DECLARING AMBITION'),
      answer('ambition-build','AMBITION NEEDS A FOUNDATION','I can promise a finish today. That will not build the squad, standards or depth needed to sustain it.',{board:1,reporter:-1},'expression_01','LONG-TERM BUILD'),
      answer('ambition-board','THE CLUB MUST MATCH THE WORDS','If {club} wants the next level, every part of the club has to support that target.',{board:-2,reporter:3,headline:true,callback:'BOARD_AMBITION'},'expression_03','CHALLENGING THE CLUB'),
      answer('ambition-table','EARN THE NEXT STEP','We are {position}. The honest ambition is winning the next match and moving from there.',{squadMorale:1,squadCount:2,reporter:1},'expression_02','GROUNDING THE TARGET')
    ],
    TRANSFER_RUMOUR:[
      answer('rumour-stays','HE IS PART OF MY PLANS','{player} is preparing with us and I expect that to continue. There is nothing more useful to add.',{targetMorale:1,targetTrust:2,reporter:-1,headline:true,callback:'PLAYER_STAYS'},'expression_02','CLOSING THE RUMOUR'),
      answer('rumour-price','EVERY SERIOUS OFFER IS CONSIDERED','I will not pretend football stands still. If a real proposal arrives, the club will judge it.',{targetMorale:-1,targetTrust:-2,board:1,reporter:3,headline:true,callback:'TRANSFER_OPEN'},'expression_03','LEAVING THE DOOR OPEN'),
      answer('rumour-false','THE STORY DID NOT COME FROM US','No club has put the reported offer in front of me. A rumour is not a negotiation.',{targetTrust:1,reporter:-2},'expression_11','DENYING THE REPORT'),
      answer('rumour-player','ASK THE PLAYER ABOUT HIS FUTURE','I know what I want. {player} also has a voice in what comes next.',{targetTrust:-1,reporter:2,headline:true,callback:'PLAYER_FUTURE'},'expression_07','PUTTING IT TO THE PLAYER'),
      answer('rumour-window','NOT BEFORE THIS MATCH','The window can wait. {player} has a job against {opponent} and that is the only conversation today.',{targetTrust:2,reporter:-1},'expression_01','FOCUSING ON MATCHDAY')
    ],
    STAFF_ROLE:[
      answer('staff-credit','THE STAFF BUILT THE WEEK','The plan you saw started with hours of work from people who never stand at this microphone.',{board:1,reputation:1,reporter:1},'expression_02','CREDITING THE STAFF'),
      answer('staff-challenge','THEY DO NOT AGREE WITH ME BY DEFAULT','Good staff make the decision stronger by challenging it before the players see it.',{board:1,reporter:2},'expression_07','VALUING DISAGREEMENT'),
      answer('staff-manager','THE FINAL CALL IS MINE','The staff give me the best information they can. Responsibility for the decision still ends with me.',{board:1,reputation:1,reporter:1},'expression_01','OWNING THE CALL'),
      answer('staff-private','I WILL NOT NAME PRIVATE DEBATES','Disagreement is healthy because it stays honest and internal. I will not turn it into a staff ranking.',{reporter:-2},'expression_11','PROTECTING THE STAFF')
    ],
    DEFEAT_RESPONSE:[
      answer('defeat-hurts','THIS SHOULD HURT','I do not want the players comfortable after that. We use the feeling, then we work.',{squadTest:'professionalism',board:1,reporter:2},'expression_03','DEMANDING A RESPONSE'),
      answer('defeat-own','I GOT PART OF IT WRONG','The plan did not give the players enough help. I will correct that before I ask them for answers.',{squadMorale:1,squadCount:3,board:1,reputation:1,reporter:3},'expression_07','ADMITTING THE ERROR'),
      answer('defeat-together','WE LOSE TOGETHER','Nobody will be isolated for one mistake. We review the match as a team and respond as one.',{squadMorale:1,squadCount:4,targetTrust:1,reporter:1},'expression_02','PROTECTING THE GROUP'),
      answer('defeat-changes','PLACES ARE OPEN NOW','That performance cannot pass without consequence. Training this week will decide who starts next.',{squadTest:'professionalism',board:2,headline:true,reporter:2,callback:'SELECTION_RESPONSE'},'expression_03','WARNING THE SQUAD'),
      answer('defeat-move','WE CANNOT REPLAY IT','The review will be honest and short. Carrying the defeat into the next match would make it cost us twice.',{squadMorale:1,squadCount:2,reporter:-1},'expression_01','DRAWING A LINE')
    ],
    VICTORY_MOMENT:[
      answer('win-enjoy','THEY SHOULD ENJOY THIS','The players earned the room tonight. Recovery starts tomorrow. For now, the win is theirs.',{squadMorale:1,squadCount:4,targetTrust:1,reporter:2},'expression_02','CELEBRATING THE WIN'),
      answer('win-standard','THIS HAS TO BECOME NORMAL','It was a strong performance. The best teams do not treat their level as a special event.',{squadTest:'ambition',board:1,reporter:1},'expression_03','RAISING EXPECTATIONS'),
      answer('win-statement','WE SHOWED WHAT WE CAN BE','Against {opponent}, in this moment, the team gave a real picture of its ceiling.',{squadMorale:1,squadCount:3,reputation:1,reporter:2,headline:true,callback:'WINNING_CLAIM'},'expression_09','MAKING A STATEMENT'),
      answer('win-details','THE RESULT CAME FROM THE WORK','The decisive moments were not accidents. The players delivered details we had rehearsed.',{targetTrust:1,squadMorale:1,squadCount:2,reporter:2,tone:'analytical'},'expression_01','PRAISING EXECUTION'),
      answer('win-next','IT BUYS US NOTHING NEXT WEEK','The points are valuable. They do not give us a head start in the next match.',{squadMorale:0,board:1,reporter:-1},'expression_11','MOVING ON QUICKLY')
    ],
    FOLLOW_UP:[
      answer('follow-stand','I STAND BY IT','You heard the answer. I will not soften it because it might become a headline.',{reporter:-1,headline:true,rivalHeat:2},'expression_03','STANDING FIRM'),
      answer('follow-clarify','LET ME BE PRECISE','I am talking about {subject} in this situation. Do not turn that into a judgement on everything else.',{reporter:2,tone:'analytical'},'expression_01','CLARIFYING THE POINT'),
      answer('follow-evidence','JUDGE THE NEXT ACTION','The answer matters only if our next decision supports it. Hold me to that.',{reporter:2,reputation:1,callback:'PRESS_PROMISE'},'expression_09','ACCEPTING THE TEST'),
      answer('follow-end','THAT IS ALL I WILL SAY','The people involved have heard more detail than I will give publicly. We can move on.',{reporter:-3,targetTrust:1},'expression_11','ENDING THE EXCHANGE')
    ],
    DEFAULT:[
      answer('default-direct','HERE IS MY ANSWER','I have given the players a clear position on this. I am comfortable putting the same answer on record.',{reporter:1},'expression_01','DIRECT ANSWER'),
      answer('default-detail','THE DETAIL MATTERS','There is not one simple explanation. We will judge the facts before making the next decision.',{reporter:1,tone:'analytical'},'expression_01','MEASURED ANSWER'),
      answer('default-private','THAT STAYS INSIDE','The people affected deserve to hear the full conversation before the public does.',{reporter:-2,targetTrust:1},'expression_11','PRIVATE ANSWER'),
      answer('default-challenge','WE HAVE TO BE BETTER','Whatever the explanation, the next performance has to show a response.',{squadTest:'professionalism',board:1},'expression_03','PUBLIC CHALLENGE')
    ]
  };
  library.framings={
    pre:["Looking at the way this week has unfolded,","With the team sheet now public,","There has been plenty of discussion outside the club.","Supporters have debated this all week.","Before we turn to the fixture itself,"],
    post:["With the emotion of full-time still fresh,","Watching from the press box,","There was a lot happening beneath the scoreline.","Supporters will leave discussing this.","Before you leave the stadium,"]
  };
  library.reporterFramings={
    direct:["Let me put this plainly.","I want a direct answer here."],
    sceptical:["Some people will struggle to accept that.","The evidence has invited a harder question."],
    analytical:["Looking beyond the obvious headline,","If we separate the result from the performance,"],
    punchy:["This is the question everyone is asking.","There is no avoiding the headline tonight."],
    measured:["If we take a step back,","In the wider context of the season,"]
  };
  library.followUps={
    bold:["You have made a strong promise about {subject}. Are you prepared for those words to be replayed if the result goes the other way?","That is a headline in itself. What gives you such certainty about {subject}?","You sound extremely confident. Is there a danger you have just motivated {opponent}?"],
    guarded:["You say that belongs inside the club, but supporters want clarity. Why should they accept no answer on {subject}?","Are you protecting {subject}, or avoiding a decision you know will be unpopular?","With respect, manager, that did not answer the question. What can you tell us about {subject}?"],
    demanding:["You have publicly challenged {subject}. What response do you expect when the dressing-room door closes?","Could that message damage confidence at precisely the moment {subject} needs support?","Is this the first time you have questioned that standard in public?"],
    supportive:["Your backing is clear, but does loyalty ever make selection less competitive?","What happens if {subject} cannot repay that faith immediately?"],
    accountable:["You have taken responsibility, but what specifically will you change before the next fixture?","At what point does taking responsibility require a different decision?"],
    human:["You have spoken very personally. Does showing that emotion help the players understand you better?","How difficult is it to keep that human perspective when the pressure becomes intense?"]
  };
  library.estimatedQuestionVariants=14000;
})();
