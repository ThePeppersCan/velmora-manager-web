(function(){
  const category=(id,label,stages,target,weight,templates,requires='')=>({id,label,stages,target,weight,templates,requires});
  const library=window.VELMORA_PRESS_CONFERENCE_LIBRARY={
    version:'V56.0',
    questionsPerConference:4,
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

  library.responseArchetypes=[
    {id:'supportive',label:'BACK THE GROUP',stance:'SUPPORTIVE',expression:'expression_02'},
    {id:'accountable',label:'TAKE RESPONSIBILITY',stance:'ACCOUNTABLE',expression:'expression_01'},
    {id:'demanding',label:'RAISE THE STANDARD',stance:'DEMANDING',expression:'expression_03'},
    {id:'guarded',label:'SHUT IT DOWN',stance:'GUARDED',expression:'expression_11'},
    {id:'bold',label:'MAKE A STATEMENT',stance:'BOLD',expression:'expression_09'},
    {id:'human',label:'SPEAK FROM THE HEART',stance:'PERSONAL',expression:'expression_07'}
  ];
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
