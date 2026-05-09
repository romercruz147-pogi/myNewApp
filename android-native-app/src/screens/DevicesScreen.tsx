import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity} from 'react-native';
import {AppScaffold} from '@/components/AppScaffold';
import {useAuth} from '@/store/AuthContext';
import firestore from '@react-native-firebase/firestore';
import {esp32Service} from '@/services/esp32Service';
export const DevicesScreen=({navigation,route}:any)=>{const {login,register,google,user,logout}=useAuth(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [status,setStatus]=useState('');
useEffect(()=>{if('Devices'==='Dashboard' && user){return firestore().collection('users').doc(user.uid).collection('devices').onSnapshot(()=>{});} },[user]);
const authLogin=async()=>{try{await login(email,password);}catch(e:any){setStatus(e.message);}};
const authRegister=async()=>{try{await register(email,password);}catch(e:any){setStatus(e.message);}};
const poll=async()=>{if(route?.params?.ip){try{const r=await esp32Service.status(route.params.ip);setStatus(JSON.stringify(r));}catch(e:any){setStatus('Disconnected');}}};
useEffect(()=>{if('Devices'==='VendoControl'){poll();const id=setInterval(poll,3000);return ()=>clearInterval(id);}},[route?.params?.ip]);
return <AppScaffold title='Devices'><View><Text style={{color:'#fff'}}>{status}</Text>{('Devices'==='Login'||'Devices'==='Register')&&<><TextInput placeholder='email' value={email} onChangeText={setEmail} style={{backgroundColor:'#fff',marginBottom:8}}/><TextInput placeholder='password' secureTextEntry value={password} onChangeText={setPassword} style={{backgroundColor:'#fff',marginBottom:8}}/></>}
{'Devices'==='Login'&&<><TouchableOpacity onPress={authLogin}><Text style={{color:'#6cf'}}>Login</Text></TouchableOpacity><TouchableOpacity onPress={()=>navigation.navigate('Register')}><Text style={{color:'#6cf'}}>Register</Text></TouchableOpacity><TouchableOpacity onPress={google}><Text style={{color:'#6cf'}}>Google Sign-In</Text></TouchableOpacity></>}
{'Devices'==='Register'&&<TouchableOpacity onPress={authRegister}><Text style={{color:'#6cf'}}>Create Account</Text></TouchableOpacity>}
{user&&<TouchableOpacity onPress={logout}><Text style={{color:'#f66'}}>Logout</Text></TouchableOpacity>}
</View></AppScaffold>;};
