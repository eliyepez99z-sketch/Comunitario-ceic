// Configuración de la conexión a Supabase
const SUPABASE_URL = "https://fzvjhdeodahtxoolxzkx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dmpoZGVvZGFodHhvb2x4emt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODc5NjYsImV4cCI6MjEwMzc2Mzk2Nn0.CdAgxnvtMwsv1ryyrqpEdmS8ShqQMLALz5_ZwHsjSHc";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const selectCurso = document.getElementById('curso');
const form = document.getElementById('inscriptionForm');
const alertBox = document.getElementById('alert-box');
const btnSubmit = document.getElementById('btnSubmit');

// Funciones para controlar la ventana emergente
function mostrarModalExito() {
    document.getElementById('modal-exito').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal-exito').style.display = 'none';
}

// 1. Obtener los cursos activos y con cupos desde Supabase
async function cargarCursos() {
    try {
        const { data, error } = await db
            .from('cursos')
            .select('id, nombre, cupos_disponibles')
            .eq('activo', true)
            .gt('cupos_disponibles', 0);

        if (error) throw error;

        selectCurso.innerHTML = '<option value="">-- Selecciona un curso --</option>';

        if (data && data.length > 0) {
            data.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = `${c.nombre} (${c.cupos_disponibles} cupos disponibles)`;
                selectCurso.appendChild(option);
            });
        } else {
            selectCurso.innerHTML = '<option value="">No hay cursos con cupos disponibles en este momento</option>';
        }
    } catch (err) {
        mostrarAlerta('Error al obtener la lista de cursos disponibles.', 'error');
        console.error(err);
    }
}

// Función auxiliar para subir archivos al Storage de Supabase
async function subirArchivo(file, carpeta) {
    if (!file) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36.substring(2, 9))}.${fileExt}`;
    const filePath = `${carpeta}/${fileName}`;

    const { data, error } = await db.storage
        .from('documentos-inscripcion') // Nombre de tu Bucket en Supabase Storage
        .upload(filePath, file);

    if (error) throw error;

    // Obtener la URL pública del archivo subido
    const { data: publicUrlData } = db.storage
        .from('documentos-inscripcion')
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

// 2. Registrar el estudiante, subir archivos y enviar solicitud de inscripción
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Procesando inscripción y subiendo archivos...";
    ocultarAlerta();

    // Captura de todos los campos del formulario HTML
    const cedula = document.getElementById('cedula').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    const fechaNacimiento = document.getElementById('fechaNaciminto').value;
    const edad = parseInt(document.getElementById('edad').value);
    const sexo = document.querySelector('input[name="sexo"]:checked')?.value;
    
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const whatsApp = document.getElementById('whatsApp').value.trim();
    
    const direccion = document.getElementById('direccion').value.trim();
    const municipio = document.getElementById('municipio').value.trim();
    const estado = document.getElementById('estado').value.trim();
    
    const nivelEducativo = document.getElementById('nivelEducativo').value;
    const institucion = document.getElementById('institucion').value.trim();
    const cursoId = selectCurso.value;

    // Captura de los archivos físicos
    const fileFotoCarnet = document.getElementById('fotoCarnet').files[0];
    const fileCedula = document.getElementById('fotoCedula').files[0];

    if (!cursoId) {
        mostrarAlerta('Por favor selecciona un curso válido.', 'warning');
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar Solicitud de Inscripción";
        return;
    }

    try {
        // 1. Subir archivos a Supabase Storage primero
        let urlFotoCarnet = null;
        let urlFotoCedula = null;

        if (fileFotoCarnet) {
            urlFotoCarnet = await subirArchivo(fileFotoCarnet, 'fotos_carnet');
        }
        if (fileCedula) {
            urlFotoCedula = await subirArchivo(fileCedula, 'fotos_cedula');
        }

        // 2. Comprobar si el estudiante ya está registrado en la BD por su cédula
        let { data: estudianteExistente, error: errConsulta } = await db
            .from('estudiantes')
            .select('id')
            .eq('documento_identidad', cedula);

        if (errConsulta) throw errConsulta;

        let estudianteId;

        if (estudianteExistente && estudianteExistente.length > 0) {
            estudianteId = estudianteExistente[0].id;
            
            // Opcional: Actualizar datos y URLs de documentos si ya existía
            await db.from('estudiantes').update({
                nombre, apellido, fecha_nacimiento: fechaNacimiento, edad, sexo,
                email, telefono, whatsapp: whatsApp, direccion, municipio, estado,
                nivel_educativo: nivelEducativo, institucion,
                foto_carnet_url: urlFotoCarnet || undefined,
                foto_cedula_url: urlFotoCedula || undefined
            }).eq('id', estudianteId);

        } else {
            // Registrar nuevo estudiante con todos sus datos extendidos y URLs de archivos
            const { data: nuevoEstudiante, error: errRegistro } = await db
                .from('estudiantes')
                .insert([{
                    documento_identidad: cedula,
                    nombre,
                    apellido,
                    fecha_nacimiento: fechaNacimiento,
                    edad,
                    sexo,
                    email,
                    telefono,
                    whatsapp: whatsApp,
                    direccion,
                    municipio,
                    estado,
                    nivel_educativo: nivelEducativo,
                    institucion,
                    foto_carnet_url: urlFotoCarnet,
                    foto_cedula_url: urlFotoCedula
                }])
                .select();

            if (errRegistro) throw errRegistro;
            estudianteId = nuevoEstudiante[0].id;
        }

        // 3. Crear la inscripción en estado 'Pendiente' vinculada al curso
        const { error: errInscripcion } = await db
            .from('inscripciones')
            .insert([{
                estudiante_id: estudianteId,
                curso_id: cursoId,
                estado: 'Pendiente'
            }]);

        if (errInscripcion) {
            if (errInscripcion.message.includes('unique') || errInscripcion.code === '23505') {
                mostrarAlerta('Ya posees una solicitud registrada para este curso.', 'warning');
            } else {
                throw errInscripcion;
            }
        } else {
            // ¡Todo salió bien! Mostrar modal de éxito
            mostrarModalExito();
            form.reset();
            cargarCursos();
        }

    } catch (err) {
        mostrarAlerta('Ocurrió un error al procesar tu solicitud: ' + err.message, 'error');
        console.error(err);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar Solicitud de Inscripción";
    }
});

function mostrarAlerta(mensaje, tipo) {
    alertBox.textContent = mensaje;
    alertBox.className = `alert-${tipo}`;
    alertBox.style.display = 'block';
}

function ocultarAlerta() {
    alertBox.style.display = 'none';
}

// Cargar los cursos al abrir la página
cargarCursos();