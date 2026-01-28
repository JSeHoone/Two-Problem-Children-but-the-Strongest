import React, { useState, useRef } from 'react';

function App() {
  // --- 상태 관리 ---
  const [view, setView] = useState("HOME"); // HOME, JOIN, ROOM
  const [roomID, setRoomID] = useState("");
  const [nickname, setNickname] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null); // 현재 발화자 닉네임
  const [isRecording, setIsRecording] = useState(false);

  // 녹음 관련 Ref
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- 비즈니스 로직 ---

  // 1. 방 만들기 (랜덤 번호 생성)
  const handleCreateRoom = () => {
    if (!nickname) return alert("닉네임을 입력해주세요.");
    const randomID = Math.floor(1000 + Math.random() * 9000).toString(); // 4자리 랜덤번호
    setRoomID(randomID);
    setView("ROOM");
  };

  // 2. 방 참여하기
  const handleJoinRoom = () => {
    if (!nickname || !roomID) return alert("닉네임과 방 번호를 입력해주세요.");
    setView("ROOM");
  };

  // 3. 발화 시작 (Speaker 권한 획득 및 녹음)
  const startSpeaking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        simulateSTT(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setCurrentSpeaker(nickname); // 내가 Speaker임을 강조
    } catch (err) {
      alert("마이크 권한이 필요합니다.");
    }
  };

  // 4. 발화 종료 (녹음 중지 및 전송)
  const stopSpeaking = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    // 실제 서비스에선 여기서 setCurrentSpeaker(null)를 하거나 
    // 결과가 올 때까지 유지할 수 있음
  };

  // 5. STT 결과 수신 시뮬레이션
  const simulateSTT = (blob) => {
    console.log("서버로 파일 전송 중...", blob);
    setTimeout(() => {
      const newMsg = {
        sender: nickname,
        text: "안녕하세요, 방금 제가 한 말이 텍스트로 변환되었습니다."
      };
      setMessages(prev => [newMsg, ...prev]); // 최신글이 위로 오게
      setCurrentSpeaker(null); // 발화 종료 후 강조 해제
    }, 1500);
  };

  // --- 컴포넌트 구성 ---

  // 상단 네비게이션 바
  const NavBar = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: '#eee' }}>
      <strong style={{ cursor: 'pointer' }} onClick={() => window.location.reload()}>AI 자막 서비스</strong>
      <div>
        <button onClick={() => alert("준비 중인 기능입니다.")}>로그인 / 회원가입</button>
      </div>
    </div>
  );

  // [메인 홈 화면]
  if (view === "HOME") {
    return (
      <div>
        <NavBar />
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <h1>환영합니다!</h1>
          <input 
            placeholder="사용할 닉네임 입력" 
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            style={{ padding: '10px', width: '250px', marginBottom: '20px' }}
          /><br/>
          <button onClick={handleCreateRoom} style={{ padding: '15px 30px', marginRight: '10px' }}>방 만들기</button>
          <button onClick={() => setView("JOIN")} style={{ padding: '15px 30px' }}>방 참여하기</button>
        </div>
      </div>
    );
  }

  // [방 참여 입력 화면]
  if (view === "JOIN") {
    return (
      <div>
        <NavBar />
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <h2>방 참여하기</h2>
          <input 
            placeholder="방 번호 4자리 입력" 
            value={roomID}
            onChange={e => setRoomID(e.target.value)}
            style={{ padding: '10px', marginBottom: '10px' }}
          /><br/>
          <button onClick={handleJoinRoom} style={{ padding: '10px 20px' }}>입장하기</button>
          <button onClick={() => setView("HOME")} style={{ marginLeft: '10px' }}>취소</button>
        </div>
      </div>
    );
  }

  // [방 내부 화면]
  return (
    <div>
      <NavBar />
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>방 번호: <span style={{ color: 'blue' }}>{roomID}</span></h2>
          <span>내 이름: <strong>{nickname}</strong></span>
        </div>

        {/* 현재 발화자 강조 영역 */}
        <div style={{ 
          padding: '20px', background: currentSpeaker ? '#fff3cd' : '#f8f9fa', 
          border: '1px solid #ffeeba', borderRadius: '10px', textAlign: 'center', margin: '20px 0'
        }}>
          {currentSpeaker ? (
            <h3 style={{ color: '#856404', margin: 0 }}>📢 {currentSpeaker} 님이 말씀 중입니다...</h3>
          ) : (
            <p style={{ margin: 0, color: '#666' }}>말씀하시려면 아래 버튼을 눌러주세요.</p>
          )}
        </div>

        {/* 자막 리스트창 (Viewer용 화면) */}
        <div style={{ 
          height: '300px', border: '2px solid #333', borderRadius: '5px',
          padding: '15px', overflowY: 'auto', background: '#000', color: '#fff' 
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: '15px', borderBottom: '1px solid #333', pb: '5px' }}>
              <span style={{ color: '#00ff00', fontSize: '0.9rem' }}>[{m.sender}]</span>
              <p style={{ fontSize: '1.2rem', margin: '5px 0' }}>{m.text}</p>
            </div>
          ))}
        </div>

        {/* 조작 버튼 (Speaker용) */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          {!isRecording ? (
            <button 
              onClick={startSpeaking} 
              disabled={currentSpeaker && currentSpeaker !== nickname}
              style={{ padding: '15px 40px', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '30px', backgroundColor: '#28a745', color: '#fff', border: 'none' }}
            >
              🎤 번역 시작 (말하기)
            </button>
          ) : (
            <button 
              onClick={stopSpeaking} 
              style={{ padding: '15px 40px', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '30px', backgroundColor: '#dc3545', color: '#fff', border: 'none' }}
            >
              ⏹️ 번역 종료
            </button>
          )}
          {currentSpeaker && currentSpeaker !== nickname && (
            <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '10px' }}>다른 사람이 말하는 중에는 참여할 수 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;