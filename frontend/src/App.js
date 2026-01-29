import React, { useState, useRef } from 'react';

/**
 * [자바 개발자를 위한 가이드]
 * useState: 클래스의 멤버 변수와 비슷하지만, 값이 바뀌면 화면을 다시 그린다는 점이 다름.
 * useRef: 클래스의 멤버 변수와 비슷하며, 값이 바뀌어도 화면을 다시 그리진 않음. (소켓 객체 등을 보관할 때 사용)
 */
function App() {
  // --- 상태 변수 (State) : 자바의 가변 필드와 유사 ---
  const [view, setView] = useState("HOME");         // 현재 화면 상태 (HOME, JOIN, ROOM)
  const [roomID, setRoomID] = useState("");         // 접속한 방 번호
  const [nickname, setNickname] = useState("");     // 유저 닉네임
  const [messages, setMessages] = useState([]);     // 자막 리스트 (List<MessageDTO>)
  const [isRecording, setIsRecording] = useState(false); // 내가 현재 녹음 중인지 여부
  const [currentSpeaker, setCurrentSpeaker] = useState(null); // 현재 방에서 누가 말하고 있는지 이름
  const [participants, setParticipants] = useState([]); // 현재 방 참여자 명단 (List<UserDTO>)

  // --- 참조 변수 (Ref) : 자바의 상수 필드나 인스턴스 보관용 ---
  const socketRef = useRef(null);         // WebSocket 인스턴스를 담는 변수 (한번 연결하면 유지)
  const mediaRecorderRef = useRef(null);   // 마이크 녹음기 객체
  const audioChunksRef = useRef([]);      // 녹음된 음성 조각들 (byte array와 유사)
  
  const MAX_CAPACITY = 2; // 방 최대 인원 설정

  /** * 1. 방 입장 함수 (백엔드 웹소켓 연결 지점) 
   * 자바의 'public void connect()' 역할
   */
  const handleEnterRoom = (isCreate) => {
    if (!nickname) return alert("닉네임을 입력하세요!");
    if (!isCreate && !roomID) return alert("방 번호를 입력하세요!");
    
    // 방 번호 생성 (백엔드에서 발급받는 것으로 수정 가능)
    const id = isCreate ? Math.floor(1000 + Math.random() * 9000).toString() : roomID;
    setRoomID(id);

    // -------------------------------------------------------
    // [백엔드 연결 포인트 1] : WebSocket 연결
    // -------------------------------------------------------
    // -> 백엔드 SW 확인
    socketRef.current = new WebSocket(`ws://localhost:8000/ws/${id}?nickname=${nickname}`);
    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "PARTICIPANTS_UPDATE") {
        setParticipants(data.payload.map(name => ({name: name, role: "User"})));
      }
      else if (data.type === "NEW_CAPTION") {
        setMessages(prev => [data.payload, ...prev]);
      }
      else if (data.type === "SPEAKER_STATUS") {
        // 누군가 말하기 시작했음을 알림
        setCurrentSpeaker(data.payload.isSpeaking ? data.payload.nickname : null);
      }
    };
    
    // (임시) 가짜 명단 세팅
    setView("ROOM");
  };

  /** * 2. 마이크 녹음 시작 (자바의 InputStream 시작과 유사) 
   */
  const startSpeaking = async () => {
    try {
      // 브라우저에게 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      // 음성 조각이 생길 때마다 배열에 담음
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      
      // 녹음이 끝났을 때(onstop) 실행될 콜백 함수 정의
      mediaRecorderRef.current.onstop = () => {
        // 배열에 담긴 조각들을 하나의 파일(Blob)로 합침 (Java의 byte[] 합치기와 유사)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // -------------------------------------------------------
        // [백엔드 연결 포인트 2] : 음성 파일 서버 전송 (HTTP POST)
        // -------------------------------------------------------
        sendAudioToBackend(audioBlob); 
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setCurrentSpeaker(nickname);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify)({
          type: "SPEAKER_START",
          nickname: nickname
        })
      }
      
      // [백엔드 연결 포인트 3] : 서버에 "나 지금 말 시작해" 라고 웹소켓 신호 보냄
    } catch (err) {
      alert("마이크 사용 권한을 허용해주세요!");
    }
  };

  /**
   * 3. 실제 백엔드로 음성파일을 전송하는 함수
   * 자바의 MultipartFile 전송 로직과 대응됨
   */
  const sendAudioToBackend = async (blob) => {
    // FormData는 자바의 MultipartRequest 객체라고 생각하면 됨
    const formData = new FormData();
    formData.append("file", blob, "recording.wav");
    formData.append("speaker_name", nickname);
    formData.append("room_id", roomID);

    try {
      // 백엔드 API 호출 (URL은 백엔드 주소로 맞춰야 함)
      const response = await fetch(`http://localhost:8000/upload-audio/${roomID}`, {
        method: "POST",
        body: formData
      });
      
      // (임시) 성공한 척 자막 추가 -> 여기에 response 매핑해야 함
      // setMessages(prev => [{ sender: nickname, text: "서버로 음성이 전송되었습니다. (STT 처리중...)" }, ...prev]);
      setCurrentSpeaker(null);
    } catch (error) {
      console.error("파일 전송 실패:", error);
    }
  };

  const stopSpeaking = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop(); // 녹음을 멈추면 위에 정의한 onstop이 실행됨
      setIsRecording(false);
    }
  };

  // --- CSS 스타일 객체들 (자바의 CSS 파일이나 상수와 같음) ---
  const primaryButtonStyle = {
    padding: '12px 24px', borderRadius: '12px', border: 'none',
    backgroundColor: '#2196f3', color: '#fff', fontWeight: '600',
    cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(33, 150, 243, 0.3)'
  };

  // --- 화면 렌더링 (자바의 JSP나 Thymeleaf 템플릿 역할) ---

  // 1. 방 입장 전 화면 (로그인/방선택)
  if (view === "HOME" || view === "JOIN") {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
        <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginBottom: '20px' }}>🎤 AI 자막 서비스</h2>
          <input 
            placeholder="닉네임 입력" 
            value={nickname} 
            onChange={e => setNickname(e.target.value)} 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '250px', marginBottom: '15px' }} 
          /><br/>
          {view === "HOME" ? (
            <>
              <button onClick={() => handleEnterRoom(true)} style={primaryButtonStyle}>방 만들기</button>
              <button onClick={() => setView("JOIN")} style={{ ...primaryButtonStyle, backgroundColor: '#fff', color: '#2196f3', marginLeft: '10px', border: '1px solid #2196f3' }}>방 참여</button>
            </>
          ) : (
            <>
              <input placeholder="방 번호 입력" onChange={e => setRoomID(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '250px', marginBottom: '15px' }} /><br/>
              <button onClick={() => handleEnterRoom(false)} style={primaryButtonStyle}>입장하기</button>
              <button onClick={() => setView("HOME")} style={{ background: 'none', border: 'none', color: '#888', marginLeft: '10px' }}>취소</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 2. 방 내부 화면 (메인 서비스)
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f0f2f5' }}>
      
      {/* 참여자 목록 (사이드바) */}
      <div style={{ width: '280px', background: '#fff', padding: '20px', borderRight: '1px solid #eee' }}>
        <h3 style={{ fontSize: '1rem', color: '#333' }}>참여자 ({participants.length}/{MAX_CAPACITY})</h3>
        <div style={{ marginTop: '20px' }}>
          {participants.map((p, i) => (
            <div key={i} style={{ padding: '10px', borderRadius: '10px', backgroundColor: currentSpeaker === p.name ? '#e3f2fd' : 'transparent', marginBottom: '5px' }}>
              <strong>{p.name === nickname ? "👤 나" : "👥 " + p.name}</strong>
              {currentSpeaker === p.name && <span style={{ color: '#2196f3', fontSize: '0.8rem', marginLeft: '10px' }}>Speaking...</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 메인 자막 창 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>ROOM <span style={{ color: '#2196f3' }}>#{roomID}</span></h2>
          <button onClick={() => window.location.reload()} style={{ color: '#ff4d4f', border: '1px solid #ff4d4f', padding: '8px 15px', borderRadius: '10px', background: 'none', cursor: 'pointer' }}>Leave Room</button>
        </div>

        {/* 현재 말하는 사람 알림 영역 */}
        <div style={{ height: '60px', background: '#fff', borderRadius: '15px', display: 'flex', alignItems: 'center', padding: '0 20px', marginBottom: '20px', border: currentSpeaker ? '2px solid #fff176' : '1px solid #eee' }}>
          {currentSpeaker ? `📢 ${currentSpeaker} 님이 말씀 중입니다...` : "🎤 말씀하시려면 아래 버튼을 누르세요."}
        </div>

        {/* 자막 리스트 (스크롤 가능) */}
        <div style={{ flex: 1, background: '#1a1a1b', borderRadius: '20px', padding: '25px', overflowY: 'auto', color: '#fff' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: '20px', borderLeft: '3px solid #4caf50', paddingLeft: '15px' }}>
              <div style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '0.8rem' }}>{m.sender}</div>
              <div style={{ fontSize: '1.2rem', marginTop: '5px' }}>{m.text}</div>
            </div>
          ))}
        </div>

        {/* 하단 제어 버튼 */}
        <div style={{ textAlign: 'center', marginTop: '25px' }}>
          {!isRecording ? (
            <button 
              onClick={startSpeaking} 
              disabled={!!currentSpeaker && currentSpeaker !== nickname} // 다른 사람이 말할 땐 비활성화
              style={{ ...primaryButtonStyle, padding: '15px 50px', borderRadius: '30px', backgroundColor: (!!currentSpeaker && currentSpeaker !== nickname) ? '#ccc' : '#2196f3' }}
            >
              🎤 번역 시작
            </button>
          ) : (
            <button 
              onClick={stopSpeaking} 
              style={{ ...primaryButtonStyle, padding: '15px 50px', borderRadius: '30px', backgroundColor: '#ff4d4f' }}
            >
              ⏹️ 번역 종료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;